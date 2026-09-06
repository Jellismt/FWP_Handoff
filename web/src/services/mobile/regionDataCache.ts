/**
 * @file regionDataCache.ts
 * @module engage-mt/services/mobile
 * @description Fetches the polygon features of a registered layer that intersect
 *              a drawn offline AOI, as Esri-rings JSON. This is the bbox-scoped
 *              generalization of `cachedLayers.fetchLayerAsRings` (which pulls a
 *              whole layer with `where=1=1`): here an `esriGeometryEnvelope`
 *              intersect filter clips the result to the region the user is
 *              downloading, and pagination walks past the service's per-request
 *              record cap so dense cadastral isn't silently truncated.
 *
 *              The `{ attributes, rings }` output matches `CachedFeature`, so the
 *              shared `pointInCachedFeatures` primitive consumes it directly for
 *              offline tap-to-identify.
 *
 *              Privacy: the bbox is the user's own drawn area; the query hits the
 *              same public ArcGIS services the live map uses. Nothing about the
 *              user is transmitted. Per `docs/rules/privacy.md`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createLogger } from "@/utils/logger";
import { findLayerById } from "@/config/layers";
import { fetchJson } from "@/utils/http";

const log = createLogger("region-data-cache");

/** Records-per-page request. Most ArcGIS services cap a single query near 1–2k. */
const PAGE_SIZE = 1000;
/**
 * Hard ceiling on features cached per layer per area. Guards against a huge AOI
 * over dense parcels pulling an unbounded set; when hit, the result is flagged
 * `truncated` and a warning is logged (never a silent cut).
 */
const MAX_FEATURES_PER_LAYER = 8000;

export interface RegionFeature {
  attributes: Record<string, unknown>;
  /** Polygon rings in [lon, lat] order. */
  rings: number[][][];
}

export interface RegionLayerResult {
  layerId: string;
  features: RegionFeature[];
  /** True when the per-layer feature ceiling was hit and more were left behind. */
  truncated: boolean;
}

export interface RegionBbox {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface QueryResponse {
  features?: Array<{
    attributes: Record<string, unknown>;
    geometry?: { rings?: number[][][] };
  }>;
  exceededTransferLimit?: boolean;
}

const envelope = (bbox: RegionBbox): string =>
  JSON.stringify({
    xmin: bbox.west,
    ymin: bbox.south,
    xmax: bbox.east,
    ymax: bbox.north,
    spatialReference: { wkid: 4326 },
  });

/**
 * Fetch every polygon feature of `layerId` intersecting `bbox`, paginating past
 * the service's transfer limit. Returns null when the layer isn't a queryable
 * polygon layer or the first request fails; a partial page-failure mid-pagination
 * returns what was gathered so far.
 */
export async function fetchLayerFeaturesInBbox(
  layerId: string,
  bbox: RegionBbox,
  opts: { signal?: AbortSignal } = {},
): Promise<RegionLayerResult | null> {
  const def = findLayerById(layerId);
  if (!def || def.geometry !== "polygon" || !def.url) {
    log.warn("Skipping non-polygon / unregistered layer", { layerId });
    return null;
  }

  const outFields =
    Array.isArray(def.outFieldsHint) && def.outFieldsHint.length > 0
      ? def.outFieldsHint.join(",")
      : "*";

  const features: RegionFeature[] = [];
  let truncated = false;
  let offset = 0;

  for (;;) {
    if (opts.signal?.aborted) break;

    const params = new URLSearchParams({
      f: "json",
      where: "1=1",
      geometry: envelope(bbox),
      geometryType: "esriGeometryEnvelope",
      spatialRel: "esriSpatialRelIntersects",
      inSR: "4326",
      outSR: "4326",
      returnGeometry: "true",
      outFields,
      resultRecordCount: String(PAGE_SIZE),
      resultOffset: String(offset),
    });

    let json: QueryResponse;
    try {
      json = await fetchJson<QueryResponse>(`${def.url}/query?${params.toString()}`, {
        signal: opts.signal,
      });
    } catch (err) {
      // First page failed → treat the layer as unavailable; a later page failing
      // returns the partial set we already have.
      if (offset === 0) {
        log.warn("Region-layer fetch failed", {
          layerId,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
      break;
    }

    const page = json.features ?? [];
    for (const f of page) {
      if (f.geometry?.rings && f.geometry.rings.length > 0) {
        features.push({ attributes: f.attributes, rings: f.geometry.rings });
      }
    }

    if (features.length >= MAX_FEATURES_PER_LAYER) {
      truncated = true;
      log.warn("Region-layer feature ceiling hit — result truncated", {
        layerId,
        cap: MAX_FEATURES_PER_LAYER,
      });
      break;
    }

    // Stop when the service reports no more records (or returned a short page).
    if (!json.exceededTransferLimit || page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { layerId, features, truncated };
}
