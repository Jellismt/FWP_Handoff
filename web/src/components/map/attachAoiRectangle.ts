/**
 * @file attachAoiRectangle.ts
 * @module engage-mt/map
 * @description Attaches a two-corner rectangle drawing session to an ArcGIS
 *              MapView for offline-map AOI selection. First tap sets a corner;
 *              a live dashed preview box follows the pointer; second tap
 *              finalizes and reports the normalized bbox. Renders a distinct
 *              FWP-yellow dashed box so it reads differently from the red
 *              field-tools draw shapes, and never persists to fieldToolsStore —
 *              the AOI is transient. Shared by the on-map "Download this area"
 *              tool (useMapInteraction) and the in-page AoiPickerMap.
 *
 *              Returns a detach function that removes the listeners + graphics.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-06-30
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type EsriMapView from "@arcgis/core/views/MapView";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Polygon from "@arcgis/core/geometry/Polygon";
import Point from "@arcgis/core/geometry/Point";
import {
  bboxFromCorners,
  bboxRing,
  isDegenerateBbox,
  type AoiBbox,
  type LonLat,
} from "@/services/map/aoiGeometry";

// FWP yellow @ low opacity for the fill; gold outline. Deliberately different
// from the field-tools red shapes so an AOI box is never mistaken for a saved
// shape. ArcGIS Color autocast: alpha is decimal 0..1.
const AOI_FILL: [number, number, number, number] = [255, 199, 44, 0.16];
const AOI_OUTLINE: [number, number, number, number] = [212, 145, 35, 1];

interface AttachAoiRectangleOptions {
  /** Called with the normalized bbox once the second corner is tapped. */
  onComplete: (bbox: AoiBbox) => void;
}

const rectRing = (a: LonLat, b: LonLat): number[][] => bboxRing(bboxFromCorners(a, b));

export const attachAoiRectangle = (
  view: EsriMapView,
  opts: AttachAoiRectangleOptions,
): (() => void) => {
  const layer = new GraphicsLayer({ id: "engage-mt-aoi", listMode: "hide" });
  view.map?.add(layer);

  let cornerA: LonLat | null = null;

  const drawCornerDot = (p: LonLat): void => {
    layer.add(
      new Graphic({
        geometry: new Point({ longitude: p[0], latitude: p[1] }),
        symbol: {
          type: "simple-marker" as const,
          style: "circle" as const,
          size: 8,
          color: AOI_OUTLINE,
          outline: { color: [255, 255, 255, 1], width: 1.5 },
        },
      }),
    );
  };

  const drawRect = (a: LonLat, b: LonLat): void => {
    layer.removeAll();
    layer.add(
      new Graphic({
        geometry: new Polygon({
          rings: [rectRing(a, b)],
          spatialReference: { wkid: 4326 },
        }),
        symbol: {
          type: "simple-fill" as const,
          color: AOI_FILL,
          outline: { color: AOI_OUTLINE, width: 2, style: "dash" as const },
        },
      }),
    );
  };

  const clickHandle = view.on("click", (e) => {
    e.stopPropagation();
    const lon = e.mapPoint.longitude;
    const lat = e.mapPoint.latitude;
    if (lon == null || lat == null) return;

    if (!cornerA) {
      cornerA = [lon, lat];
      layer.removeAll();
      drawCornerDot(cornerA);
      return;
    }

    const bbox = bboxFromCorners(cornerA, [lon, lat]);
    cornerA = null;
    layer.removeAll();
    if (isDegenerateBbox(bbox)) return; // ignore a same-point double tap
    opts.onComplete(bbox);
  });

  // Rubber-band preview: once the first corner is set, redraw the box to the
  // current pointer position on every move.
  const moveHandle = view.on("pointer-move", (e) => {
    if (!cornerA) return;
    const pt = view.toMap({ x: e.x, y: e.y });
    if (!pt || pt.longitude == null || pt.latitude == null) return;
    drawRect(cornerA, [pt.longitude, pt.latitude]);
  });

  return () => {
    clickHandle.remove();
    moveHandle.remove();
    try {
      view.map?.remove(layer);
    } catch {
      // already removed
    }
  };
};
