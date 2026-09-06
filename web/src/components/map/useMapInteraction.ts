/**
 * @file useMapInteraction.ts
 * @module engage-mt/map
 * @description Hook that activates lightweight on-canvas draw + measure
 *              behavior driven by `mapInteractionStore.activeTool`. Uses
 *              click events on the MapView to collect vertices, renders a
 *              live preview into a dedicated GraphicsLayer, and on
 *              double-click commits the result to `fieldToolsStore`.
 *
 *              Deliberately avoids depending on ArcGIS Sketch / Measurement
 *              widget modules to keep the main bundle small. The math
 *              (haversine distance, spherical polygon area via geometryEngine)
 *              uses the already-loaded core geometry engine.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-07
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect } from "react";
import type EsriMapView from "@arcgis/core/views/MapView";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Polygon from "@arcgis/core/geometry/Polygon";
import Polyline from "@arcgis/core/geometry/Polyline";
import Point from "@arcgis/core/geometry/Point";
// Named imports unblock tree-shaking; the namespace import
// pulled the entire geometryEngine module into the main chunk.
import { geodesicLength, geodesicArea } from "@arcgis/core/geometry/geometryEngine";
import { formatMeasureDistance, formatMeasureArea } from "@/utils/units";
import { useMapInteractionStore, type MapTool } from "@/store/map/mapInteractionStore";
import { useFieldToolsStore } from "@/store/field/fieldToolsStore";
import { useToast } from "@/hooks/useToast";
import { attachAoiRectangle } from "./attachAoiRectangle";
import { useOfflineAoiDraftStore } from "@/store/field/offlineAoiDraftStore";
import { createLogger } from "@/utils/logger";

const log = createLogger("useMapInteraction");

// ArcGIS Color autocast: alpha is DECIMAL 0..1, not 0..255. Old values
// >1 clamped to fully opaque.
const FILL_COLOR: Record<MapTool, [number, number, number, number]> = {
  none: [0, 0, 0, 0],
  "draw-polygon": [197, 40, 61, 0.31], // FWP red @ 31%
  "draw-polyline": [197, 40, 61, 0.78],
  "measure-distance": [255, 199, 44, 0.86], // FWP yellow
  "measure-area": [229, 114, 0, 0.31], // FWP orange @ 31%
  "drop-waypoint": [255, 199, 44, 0.86], // FWP yellow — same hue as measure-distance
  // AOI box draws via attachAoiRectangle (its own layer/symbols); this entry
  // only satisfies the Record<MapTool> exhaustiveness contract.
  "select-offline-aoi": [255, 199, 44, 0.16],
};

const OUTLINE_COLOR: Record<MapTool, [number, number, number, number]> = {
  none: [0, 0, 0, 0],
  "draw-polygon": [197, 40, 61, 0.9],
  "draw-polyline": [197, 40, 61, 0.9],
  "measure-distance": [212, 145, 35, 1],
  "measure-area": [229, 114, 0, 1],
  "drop-waypoint": [212, 145, 35, 1],
  "select-offline-aoi": [212, 145, 35, 1], // gold — see note on FILL_COLOR
};

const isPolygonTool = (t: MapTool): boolean => t === "draw-polygon" || t === "measure-area";
const isPolylineTool = (t: MapTool): boolean => t === "draw-polyline" || t === "measure-distance";

/**
 * Activate the on-map draw + measure behavior. Pass the ArcGIS MapView
 * (or null when un-mounted) — the hook attaches click listeners as long
 * as it has both a view and a non-none active tool.
 */
export const useMapInteraction = (view: EsriMapView | null): void => {
  const activeTool = useMapInteractionStore((s) => s.activeTool);
  const clearActiveTool = useMapInteractionStore((s) => s.clearActiveTool);
  const addShape = useFieldToolsStore((s) => s.addShape);
  const addMeasurement = useFieldToolsStore((s) => s.addMeasurement);
  const addWaypoint = useFieldToolsStore((s) => s.addWaypoint);
  const { show } = useToast();
  const setAoiDraft = useOfflineAoiDraftStore((s) => s.setBbox);

  useEffect(() => {
    if (!view || activeTool === "none") return;

    // Drop-waypoint is a single-tap tool: no sketch session,
    // no vertex collection. Handled inline before the sketch wiring runs
    // so we don't add a graphics layer the user never sees.
    if (activeTool === "drop-waypoint") {
      const clickHandle = view.on("click", (e) => {
        e.stopPropagation();
        const lat = e.mapPoint?.latitude;
        const lon = e.mapPoint?.longitude;
        if (
          typeof lat !== "number" ||
          typeof lon !== "number" ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lon)
        ) {
          return;
        }
        const stamp = new Date().toISOString().slice(0, 10);
        addWaypoint({
          kind: "general",
          name: `Waypoint ${stamp}`,
          lat,
          lon,
        });
        show({
          kind: "success",
          title: "Waypoint saved",
          message: `Lat ${lat.toFixed(5)}, Lon ${lon.toFixed(5)} — open Field Tools to add notes or a photo.`,
        });
        clearActiveTool();
      });
      return () => {
        clickHandle.remove();
      };
    }

    // Offline-map AOI selection — two taps draw a rectangle box. Delegated to
    // the reusable attachAoiRectangle helper (also used by the in-page
    // AoiPickerMap). The captured bbox lands in offlineAoiDraftStore, which the
    // OfflineAoiConfirmSheet observes; we clear the tool so the user drops back
    // into normal tap-to-query mode while they confirm.
    if (activeTool === "select-offline-aoi") {
      const detach = attachAoiRectangle(view, {
        onComplete: (bbox) => {
          setAoiDraft(bbox);
          clearActiveTool();
        },
      });
      const onKeyDown = (e: KeyboardEvent): void => {
        if (e.key === "Escape") clearActiveTool();
      };
      window.addEventListener("keydown", onKeyDown);
      return () => {
        detach();
        window.removeEventListener("keydown", onKeyDown);
      };
    }

    // Dedicated graphics layer for the active sketch session.
    const sketchLayer = new GraphicsLayer({
      id: "engage-mt-sketch",
      listMode: "hide",
    });
    view.map?.add(sketchLayer);

    const vertices: Array<[number, number]> = [];

    const renderPreview = (): void => {
      sketchLayer.removeAll();
      if (vertices.length === 0) return;

      // Render each vertex as a small dot.
      for (const [lon, lat] of vertices) {
        sketchLayer.add(
          new Graphic({
            geometry: new Point({ longitude: lon, latitude: lat }),
            symbol: {
              type: "simple-marker" as const,
              style: "circle" as const,
              size: 8,
              color: OUTLINE_COLOR[activeTool],
              outline: { color: [255, 255, 255, 1], width: 1.5 },
            },
          }),
        );
      }

      if (vertices.length >= 2 && isPolylineTool(activeTool)) {
        const linePath = new Polyline({
          paths: [vertices.map(([lon, lat]) => [lon, lat])],
          spatialReference: { wkid: 4326 },
        });
        sketchLayer.add(
          new Graphic({
            geometry: linePath,
            symbol: {
              type: "simple-line" as const,
              color: OUTLINE_COLOR[activeTool],
              width: 3,
            },
          }),
        );
        // Live on-map distance label at the working end,
        // yards under ½ mi then miles. TextSymbol autocast per gridOverlay's
        // solved pattern (plain object, no return-type annotation).
        if (activeTool === "measure-distance") {
          const meters = geodesicLength(linePath, "meters");
          const [lastLon, lastLat] = vertices[vertices.length - 1];
          sketchLayer.add(
            new Graphic({
              geometry: new Point({ longitude: lastLon, latitude: lastLat }),
              symbol: {
                type: "text" as const,
                text: formatMeasureDistance(meters),
                color: [45, 55, 72, 0.98],
                haloColor: [255, 255, 255, 0.95],
                haloSize: 1.75,
                font: { size: 13, weight: "bold" as const },
                yoffset: 14,
              },
            }),
          );
        }
      }

      if (vertices.length >= 3 && isPolygonTool(activeTool)) {
        const ringPoly = new Polygon({
          rings: [[...vertices.map(([lon, lat]) => [lon, lat]), [vertices[0][0], vertices[0][1]]]],
          spatialReference: { wkid: 4326 },
        });
        sketchLayer.add(
          new Graphic({
            geometry: ringPoly,
            symbol: {
              type: "simple-fill" as const,
              color: FILL_COLOR[activeTool],
              outline: { color: OUTLINE_COLOR[activeTool], width: 2.5 },
            },
          }),
        );
        if (activeTool === "measure-area") {
          const sqMeters = geodesicArea(ringPoly, "square-meters");
          const c = ringPoly.centroid;
          if (c) {
            sketchLayer.add(
              new Graphic({
                geometry: c,
                symbol: {
                  type: "text" as const,
                  text: formatMeasureArea(Math.abs(sqMeters)),
                  color: [45, 55, 72, 0.98],
                  haloColor: [255, 255, 255, 0.95],
                  haloSize: 1.75,
                  font: { size: 13, weight: "bold" as const },
                },
              }),
            );
          }
        }
      }
    };

    const finish = (): void => {
      // Snapshot the sketch vertices before saving. `vertices` is the LIVE
      // session array and is wiped (`.length = 0`) at the end of finish() —
      // passing it by reference would empty the saved item in place (the
      // shape then vanishes from the map until a reload rehydrates the
      // persisted copy, which was serialized before the wipe).
      const saved = vertices.map(([lon, lat]) => [lon, lat] as [number, number]);
      try {
        if (activeTool === "measure-distance" && vertices.length >= 2) {
          const path = new Polyline({
            paths: [vertices.map(([lon, lat]) => [lon, lat])],
            spatialReference: { wkid: 4326 },
          });
          const meters = geodesicLength(path, "meters");
          const miles = meters / 1609.344;
          addMeasurement({
            kind: "distance",
            vertices: saved,
            value: miles,
          });
          show({
            kind: "success",
            title: "Distance saved",
            message: `${miles.toFixed(2)} mi · saved to Field Tools.`,
            action: { label: "View in Field Tools", to: "/field" },
          });
        } else if (activeTool === "measure-area" && vertices.length >= 3) {
          const poly = new Polygon({
            rings: [
              [...vertices.map(([lon, lat]) => [lon, lat]), [vertices[0][0], vertices[0][1]]],
            ],
            spatialReference: { wkid: 4326 },
          });
          const sqMeters = Math.abs(geodesicArea(poly, "square-meters"));
          const acres = sqMeters / 4046.8564224;
          addMeasurement({
            kind: "area",
            vertices: saved,
            value: acres,
          });
          show({
            kind: "success",
            title: "Area saved",
            message: `${acres.toFixed(2)} ac · saved to Field Tools.`,
            action: { label: "View in Field Tools", to: "/field" },
          });
        } else if (activeTool === "draw-polygon" && vertices.length >= 3) {
          addShape({
            name: `Polygon ${new Date().toLocaleTimeString()}`,
            shape: "polygon",
            vertices: saved,
            color: "red",
          });
          show({
            kind: "success",
            title: "Polygon saved",
            message: `${vertices.length} vertices · saved to Field Tools.`,
            action: { label: "View in Field Tools", to: "/field" },
          });
        } else if (activeTool === "draw-polyline" && vertices.length >= 2) {
          addShape({
            name: `Polyline ${new Date().toLocaleTimeString()}`,
            shape: "polyline",
            vertices: saved,
            color: "red",
          });
          show({
            kind: "success",
            title: "Polyline saved",
            message: `${vertices.length} vertices · saved to Field Tools.`,
            action: { label: "View in Field Tools", to: "/field" },
          });
        }
      } catch (err) {
        // Geometry-engine occasionally throws on degenerate inputs —
        // coincident vertices, self-intersecting polygons, etc. The
        // previous silent ignore left users staring at a click that
        // did nothing. Now we surface a non-blocking toast + log so a
        // bad shape is at least visible.
        log.debug("draw/measure finalize failed", {
          tool: activeTool,
          vertexCount: vertices.length,
          error: err instanceof Error ? err.message : String(err),
        });
        show({
          kind: "warning",
          title: "Couldn't finish the shape",
          message:
            "The shape has coincident or self-intersecting vertices. Try again with a clearer path.",
        });
      }
      // Drop the sketch layer + clear the active tool so the user is back
      // in normal tap-to-query mode.
      view.map?.remove(sketchLayer);
      vertices.length = 0;
      clearActiveTool();
    };

    const clickHandle = view.on("click", (e) => {
      e.stopPropagation();
      // ArcGIS 5 narrowed mapPoint.{longitude,latitude} to nullable;
      // outside the view's spatial reference they can be null. Skip
      // the click rather than coerce, so the preview stays consistent.
      const lon = e.mapPoint?.longitude;
      const lat = e.mapPoint?.latitude;
      if (lon == null || lat == null) return;
      vertices.push([lon, lat]);
      renderPreview();
    });

    const dblClickHandle = view.on("double-click", (e) => {
      e.stopPropagation();
      finish();
    });

    // Esc closes the session without saving.
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        view.map?.remove(sketchLayer);
        vertices.length = 0;
        clearActiveTool();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      clickHandle.remove();
      dblClickHandle.remove();
      window.removeEventListener("keydown", onKeyDown);
      try {
        view.map?.remove(sketchLayer);
      } catch {
        // already removed
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeTool, addShape, addMeasurement, clearActiveTool, show, setAoiDraft]);
};
