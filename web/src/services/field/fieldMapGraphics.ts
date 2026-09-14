/**
 * @file fieldMapGraphics.ts
 * @module engage-mt/services/field
 * @description Renders saved field-tools waypoints + captured
 *              routes + drawn shapes as ArcGIS Graphics on a dedicated
 *              `GraphicsLayer` attached above all the operational
 *              FeatureLayers. The layer is sorted ABOVE the data layers
 *              (it's a personal overlay, must always be visible) and
 *              BELOW the mask graphic (which dims out-of-Montana
 *              background).
 *
 *              Subscribes to `useFieldToolsStore` so the graphics
 *              re-render whenever the user adds / edits / removes an
 *              item. Cleanup is user-driven via the returned
 *              `detach()` function.
 *
 *              Graphics now carry a richer attribute payload so
 *              the tap-route hit-test (MapView click handler) can
 *              dispatch to the synthetic field-feature renderers
 *              (`engage-mt-field-waypoint` / `-track` / `-shape`) with
 *              the data the cards need. The cards still re-resolve fresh
 *              state from the store by `id` so post-tap edits propagate
 *              without stale attrs.
 *
 *              Privacy: rendering is purely local — graphics live in
 *              the ArcGIS scene and never get sent to a tile service or
 *              telemetry pipeline.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import EsriMap from "@arcgis/core/Map";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import Polyline from "@arcgis/core/geometry/Polyline";
import Polygon from "@arcgis/core/geometry/Polygon";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import {
  useFieldToolsStore,
  WAYPOINT_COLOR_VAR,
  WAYPOINT_KIND_INFO,
  type DrawnShape,
  type Waypoint,
  type CapturedRoute,
} from "@/store/field/fieldToolsStore";
import { useTrackRecorderStore } from "@/services/field/trackRecorder";
import { useThemeStore } from "@/store/app/themeStore";
import { useUserGraphicsVisibleStore } from "@/store/field/userGraphicsVisibleStore";
import { createLogger } from "@/utils/logger";
import { cssVarToHex } from "@/utils/cssVarToHex";
import { splitPath } from "./pathSegments";

const log = createLogger("field-map-graphics");

const LAYER_ID = "engage-mt-field-tools";
const LAYER_TITLE = "My field tools";

/** Brand-palette → CSS-var lookup for drawn-shape colors. */
const SHAPE_COLOR_VAR: Record<DrawnShape["color"], string> = {
  red: "var(--fwp-red)",
  orange: "var(--fwp-orange)",
  yellow: "var(--fwp-yellow)",
  green: "var(--fwp-green-dark)",
  blue: "var(--fwp-blue)",
  purple: "var(--fwp-domain-mercury)",
};

const waypointGraphic = (w: Waypoint): Graphic => {
  const info = WAYPOINT_KIND_INFO[w.kind];
  // `color` override resolved through the brand-token map so a
  // user-customized waypoint follows the live light/dark theme; falls back
  // to the kind's default token when unset.
  const colorVar = w.color ? WAYPOINT_COLOR_VAR[w.color] : info.color;
  const color = cssVarToHex(colorVar);
  return new Graphic({
    geometry: new Point({ longitude: w.lon, latitude: w.lat }),
    attributes: {
      __feature_kind: "waypoint",
      id: w.id,
      name: w.name,
      kind: w.kind,
      notes: w.notes ?? "",
      lat: w.lat,
      lon: w.lon,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      photoCount: w.photos?.length ?? 0,
    },
    symbol: new SimpleMarkerSymbol({
      style: "circle",
      color,
      size: 12,
      outline: { color: "#FFFFFF", width: 2 },
    }),
  });
};

const routeGraphic = (r: CapturedRoute, accentHex: string): Graphic | null => {
  if (r.path.length < 2) return null;
  return new Graphic({
    geometry: new Polyline({
      // One path per segment so a recording gap is not drawn as a line.
      paths: splitPath(r.path, r.segments)
        .filter((seg) => seg.length >= 2)
        .map((seg) => seg.map(([lon, lat]) => [lon, lat])),
      spatialReference: { wkid: 4326 },
    }),
    attributes: {
      __feature_kind: "route",
      id: r.id,
      name: r.name,
      notes: r.notes ?? "",
      distanceMi: r.distanceMi,
      gainFt: r.gainFt,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      sampleCount: r.path.length,
    },
    symbol: new SimpleLineSymbol({
      color: accentHex,
      width: 3.5,
      style: "solid",
    }),
  });
};

/** Build the polygon ring for a circle defined by [center, edge] pair. */
const circleRing = (vertices: ReadonlyArray<readonly [number, number]>): number[][] => {
  if (vertices.length < 2) return [];
  const [cx, cy] = vertices[0];
  const [ex, ey] = vertices[1];
  // approximate radius in degrees; close enough for rendering — area math
  // happens in the renderer card with the equirectangular correction.
  const radius = Math.hypot(ex - cx, ey - cy);
  const STEPS = 64;
  const ring: number[][] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * Math.PI * 2;
    ring.push([cx + radius * Math.cos(t), cy + radius * Math.sin(t)]);
  }
  return ring;
};

const shapeGraphic = (sh: DrawnShape): Graphic | null => {
  const colorVar = SHAPE_COLOR_VAR[sh.color] ?? "var(--fwp-blue)";
  const strokeHex = cssVarToHex(colorVar);
  const fillHex = cssVarToHex(colorVar);
  const baseAttributes = {
    __feature_kind: "shape",
    id: sh.id,
    name: sh.name,
    shape: sh.shape,
    color: sh.color,
    notes: sh.notes ?? "",
    createdAt: sh.createdAt,
    vertexCount: sh.vertices.length,
  };

  if (sh.shape === "polyline") {
    if (sh.vertices.length < 2) return null;
    return new Graphic({
      geometry: new Polyline({
        paths: [sh.vertices.map(([lon, lat]) => [lon, lat])],
        spatialReference: { wkid: 4326 },
      }),
      attributes: baseAttributes,
      symbol: new SimpleLineSymbol({ color: strokeHex, width: 3, style: "solid" }),
    });
  }

  let ring: number[][];
  if (sh.shape === "circle") {
    ring = circleRing(sh.vertices);
    if (ring.length < 4) return null;
  } else if (sh.shape === "rectangle") {
    if (sh.vertices.length < 2) return null;
    const [aLon, aLat] = sh.vertices[0];
    const [bLon, bLat] = sh.vertices[1];
    ring = [
      [aLon, aLat],
      [bLon, aLat],
      [bLon, bLat],
      [aLon, bLat],
      [aLon, aLat],
    ];
  } else {
    if (sh.vertices.length < 3) return null;
    ring = sh.vertices.map(([lon, lat]) => [lon, lat]);
    // Close the polygon if the caller didn't.
    const [firstLon, firstLat] = ring[0];
    const [lastLon, lastLat] = ring[ring.length - 1];
    if (firstLon !== lastLon || firstLat !== lastLat) {
      ring.push([firstLon, firstLat]);
    }
  }

  return new Graphic({
    geometry: new Polygon({
      rings: [ring],
      spatialReference: { wkid: 4326 },
    }),
    attributes: baseAttributes,
    symbol: new SimpleFillSymbol({
      color: [...hexToRgb(fillHex), 0.18],
      outline: { color: strokeHex, width: 2.5 },
    }),
  });
};

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [0, 0, 0];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [Number.isFinite(r) ? r : 0, Number.isFinite(g) ? g : 0, Number.isFinite(b) ? b : 0];
};

const activeTrackGraphic = (
  path: ReadonlyArray<readonly [number, number]>,
  segments: readonly number[],
  recordingColor: string,
): Graphic | null => {
  if (path.length < 2) return null;
  return new Graphic({
    geometry: new Polyline({
      paths: splitPath(path, segments)
        .filter((seg) => seg.length >= 2)
        .map((seg) => seg.map(([lon, lat]) => [lon, lat])),
      spatialReference: { wkid: 4326 },
    }),
    attributes: { __feature_kind: "active-track" },
    symbol: new SimpleLineSymbol({
      color: recordingColor,
      width: 4,
      style: "dash",
    }),
  });
};

interface AttachOpts {
  map: EsriMap;
}

/**
 * Attach the field-tools graphics layer to a map. Returns a `detach`
 * callback that removes the layer + the store subscriptions.
 *
 * Idempotent: if the layer is already attached, returns a no-op
 * detach and leaves the existing subscription in place.
 */
export const attachFieldGraphics = ({ map }: AttachOpts): (() => void) => {
  if (map.findLayerById(LAYER_ID)) {
    return () => {
      /* already attached by a prior call; second caller is a no-op */
    };
  }
  const layer = new GraphicsLayer({
    id: LAYER_ID,
    title: LAYER_TITLE,
    listMode: "show",
  });
  map.add(layer);

  // Read colors at render time (not at attach time) so a
  // theme flip propagates to every graphic on the next rerender.
  // Themes flip the brand-token computed values; cssVarToHex reads
  // the body computed style fresh.
  const rerender = (): void => {
    // "Hide my pins" toggle. The layer stays attached (so we
    // don't churn the map view's layer list) but renders nothing when
    // the user has stowed their pins to inspect the operational overlay
    // underneath. Active-track recording still renders so the user can
    // see their in-progress route regardless.
    const userGraphicsVisible = useUserGraphicsVisibleStore.getState().visible;
    layer.removeAll();
    const recordingColor = cssVarToHex("var(--fwp-danger)");
    const accentColor = cssVarToHex("var(--fwp-accent-explore)");
    const tools = useFieldToolsStore.getState();
    const recorder = useTrackRecorderStore.getState();
    if (!userGraphicsVisible) {
      // Still render the in-progress recording so the user has feedback
      // that the track is actively capturing.
      if (
        (recorder.status === "recording" || recorder.status === "paused") &&
        recorder.path.length > 1
      ) {
        const g = activeTrackGraphic(recorder.path, recorder.segments, recordingColor);
        if (g) layer.add(g);
      }
      return;
    }
    for (const w of tools.waypoints) {
      layer.add(waypointGraphic(w));
    }
    for (const r of tools.routes) {
      const g = routeGraphic(r, accentColor);
      if (g) layer.add(g);
    }
    for (const sh of tools.shapes) {
      const g = shapeGraphic(sh);
      if (g) layer.add(g);
    }
    if (
      (recorder.status === "recording" || recorder.status === "paused") &&
      recorder.path.length > 1
    ) {
      const g = activeTrackGraphic(recorder.path, recorder.segments, recordingColor);
      if (g) layer.add(g);
    }
  };

  // Coalesce subscription firings through a single
  // requestAnimationFrame tick so back-to-back store updates (e.g.,
  // a GPS sample arriving the same tick as a waypoint save) rebuild
  // the GraphicsLayer once instead of N times. Cuts GC pressure on
  // the track-recorder path without changing visual behavior.
  let frame: number | null = null;
  const scheduleRerender = (): void => {
    if (frame != null) return;
    if (typeof requestAnimationFrame === "undefined") {
      rerender();
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = null;
      rerender();
    });
  };

  rerender();
  const unsubscribeTools = useFieldToolsStore.subscribe(scheduleRerender);
  const unsubscribeRecorder = useTrackRecorderStore.subscribe(scheduleRerender);
  // Theme subscription: brand tokens flip on dark-mode
  // toggle; without this, in-flight graphics keep their old colors
  // until the next user-driven store change. Subscribe + rerender.
  const unsubscribeTheme = useThemeStore.subscribe(scheduleRerender);
  // Visibility-toggle subscription. Flips the entire
  // user-graphics layer on/off without unmounting it.
  const unsubscribeVisibility = useUserGraphicsVisibleStore.subscribe(scheduleRerender);
  log.info("field graphics layer attached");

  return () => {
    try {
      unsubscribeTools();
      unsubscribeRecorder();
      unsubscribeTheme();
      unsubscribeVisibility();
      if (frame != null && typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(frame);
        frame = null;
      }
      map.remove(layer);
      log.info("field graphics layer detached");
    } catch (err) {
      log.warn("detach failed", { error: err instanceof Error ? err.message : String(err) });
    }
  };
};

/** Re-exported so the MapView click handler can hit-test against the layer. */
export const FIELD_GRAPHICS_LAYER_ID = LAYER_ID;
