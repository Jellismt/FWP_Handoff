/**
 * @file tapQueryHighlightBridge.ts
 * @module engage-mt/services/map
 * @description Wire tap-query clicks into the same fish-accent
 *              halo that search hits use. Without this, clicking a feature
 *              on the map produced a brief white-ring pulse but no durable
 *              halo, while clicking a search result produced a 60s pulsing
 *              halo. The two interactions now feel consistent.
 *
 *              Called from the MapView click handler when a tap returns
 *              at least one feature. Reads the topmost graphic's geometry,
 *              determines a halo kind from the layer's geometry type, and
 *              dispatches to `useHighlightedFeatureStore` with a short TTL
 *              (8s) so the tap halo fades faster than a search halo (60s).
 *
 *              The popup is for the thing you clicked,
 *              and the map gives you a visual answer to "did I hit it?"
 *
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type Point from "@arcgis/core/geometry/Point";
import { useHighlightedFeatureStore } from "@/store/map/highlightedFeatureStore";
import type { HighlightGeometry } from "@/store/map/featureFocusStore";
import type { LayerGeometry } from "@/types/layers";

const TAP_HALO_TTL_MS = 8_000;

const KIND_FROM_GEOMETRY: Record<LayerGeometry, "waterbody" | "fas" | "point" | "polygon"> = {
  point: "point",
  line: "polygon", // line geometries get the polygon-shaped halo (longer arc)
  polygon: "polygon",
  raster: "polygon",
  mixed: "point",
  "vector-tile": "point",
};

interface TapHighlightArgs {
  /**
   * Either an ArcGIS Point graphic (from a click event) or a plain
   * lat/lon pair (from a flyTo dispatch — the source page may not have
   * the view in scope to build a Point object).
   */
  mapPoint: Point | { latitude: number; longitude: number };
  /** The topmost layer's geometry kind from LayerDef. */
  geometry?: LayerGeometry;
  /**
   * The clicked feature's actual vector geometry (WGS84 rings/paths)
   * so its boundary can be outlined, not just haloed. Paired with an Infinity
   * `geometryFadeMs` this keeps the parcel outlined while the panel is open.
   */
  outline?: HighlightGeometry | null;
  /** Optional human-readable label — usually the layer's title or the feature's NAME. */
  label?: string;
  /**
   * Optional TTL override. Defaults to TAP_HALO_TTL_MS
   * (8 s) for tap-query callers; flyTo callers pass 3000 so the
   * "View on map" feedback is shorter and snappier per the user
   * design ask. The panel-opening tap passes `Infinity` so the
   * highlight persists until the panel closes (MapPage clears it).
   */
  ttlMs?: number;
  /** Fade window for the vector outline; `Infinity` = never fade. */
  geometryFadeMs?: number;
}

/**
 * Dispatch a short-lived halo at the tap point. Idempotent: each new tap
 * overwrites the previous selected target, so the halo follows the user's
 * most recent click.
 */
export function highlightTapQueryHit({
  mapPoint,
  geometry,
  outline,
  label,
  ttlMs,
  geometryFadeMs,
}: TapHighlightArgs): void {
  const kind = geometry ? KIND_FROM_GEOMETRY[geometry] : "point";
  const lat = mapPoint.latitude;
  const lon = mapPoint.longitude;
  // Refuse non-finite coords (NaN, Infinity) too — they pass the typeof
  // check but produce a halo at "nowhere" which the user sees as no
  // halo + a console warning when ArcGIS tries to project it.
  if (typeof lat !== "number" || !Number.isFinite(lat)) return;
  if (typeof lon !== "number" || !Number.isFinite(lon)) return;
  useHighlightedFeatureStore.getState().set({
    lat,
    lon,
    label: label ?? "Selected feature",
    kind,
    ttlMs: ttlMs ?? TAP_HALO_TTL_MS,
    geometry: outline ?? null,
    geometryFadeMs,
  });
}
