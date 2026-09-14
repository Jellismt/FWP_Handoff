/**
 * @file pointInFeatures.ts
 * @module engage-mt/services/spatialContext
 * @description Shared on-device point-in-polygon primitive. Given a point and a
 *              set of ring-bearing features (the `{ rings }` shape produced by
 *              cachedLayers / regionDataCache), returns the first feature that
 *              contains the point, or null. Lazy-loads
 *              `@turf/boolean-point-in-polygon` so the geometry engine stays out
 *              of the main chunk.
 *
 *              Backs the offline tap-to-identify resolver so every caller
 *              shares ONE point-in-polygon implementation. Coordinate order is
 *              `[lon, lat]` (GeoJSON), standardized across all callers.
 *
 *              Privacy: the point is evaluated in-process against public layer
 *              geometry; nothing is transmitted. Per `docs/rules/privacy.md`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createLogger } from "@/utils/logger";

const log = createLogger("point-in-features");

/** The minimal structural shape the evaluator needs: polygon rings in [lon,lat]. */
export interface RingFeature {
  /** Polygon rings in [lon, lat] order (Esri `geometry.rings` / GeoJSON coords). */
  rings: number[][][];
}

/** Ray-cast point-in-polygon. Lazy-loaded via dynamic import, then memoized. */
let rawPointInPoly:
  | ((point: GeoJSON.Feature<GeoJSON.Point>, polygon: GeoJSON.Feature<GeoJSON.Polygon>) => boolean)
  | null = null;

/** Resolve (and cache) the turf point-in-polygon fn, or null if the import fails. */
const ensurePointInPoly = async (): Promise<typeof rawPointInPoly> => {
  if (rawPointInPoly) return rawPointInPoly;
  try {
    const mod = await import("@turf/boolean-point-in-polygon");
    rawPointInPoly = mod.default;
    return rawPointInPoly;
  } catch (err) {
    log.warn("Failed to load @turf/boolean-point-in-polygon", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
};

/**
 * Return the first feature whose rings contain `[lon, lat]`, or null. Generic
 * over the feature type so callers get their own row type back (the offline
 * resolver gets its cached feature, etc.).
 *
 * Returns null if the geometry engine can't load — callers treat that as
 * "can't determine here" and drop the row (partial-data tolerance).
 */
export async function pointInCachedFeatures<F extends RingFeature>(
  lon: number,
  lat: number,
  features: readonly F[],
): Promise<F | null> {
  const fn = await ensurePointInPoly();
  if (!fn) return null;
  const point: GeoJSON.Feature<GeoJSON.Point> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [lon, lat] },
  };
  for (const feature of features) {
    if (!feature.rings || feature.rings.length === 0) continue;
    const polygon: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: feature.rings },
    };
    if (fn(point, polygon)) return feature;
  }
  return null;
}
