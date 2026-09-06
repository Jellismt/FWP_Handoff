/**
 * @file offlineDataResolver.ts
 * @module engage-mt/services/mobile
 * @description Reads the region vector data captured for a downloaded area and
 *              answers "what features sit under this point" from local disk — the
 *              read side of the offline tap-to-identify story. The vector
 *              companion to `offlineTileResolver`: it finds the downloaded area
 *              whose bbox contains the tapped point, loads that area's cached
 *              layers off @capacitor/filesystem, and runs the shared
 *              point-in-polygon primitive to return the containing feature's
 *              attributes per layer.
 *
 *              Returns nothing off-Capacitor or when no downloaded area covers
 *              the point, so an offline tap outside any download degrades
 *              gracefully to the empty-tap notice.
 *
 *              Privacy: every read is from local disk; no network calls. The tap
 *              point stays on-device. Per `docs/rules/privacy.md`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { isCapacitor } from "@/utils/capacitor";
import { listDownloadedAreas, type OfflineAreaRef } from "./offlineTileResolver";
import { pointInCachedFeatures } from "@/services/spatialContext/pointInFeatures";
import type { CachedLayerPayload } from "./vectorDownloader";

export interface OfflineFeatureHit {
  layerId: string;
  attributes: Record<string, unknown>;
  /** True when the layer's cache was capped during download (partial coverage). */
  truncated: boolean;
}

interface MinimalFsRead {
  readFile: (opts: { path: string; directory: string; encoding?: string }) => Promise<{
    data: string;
  }>;
}

const areaContainsPoint = (area: OfflineAreaRef, lon: number, lat: number): boolean =>
  lon >= area.bbox.west &&
  lon <= area.bbox.east &&
  lat >= area.bbox.south &&
  lat <= area.bbox.north;

const readCachedLayer = async (
  fs: MinimalFsRead,
  dir: Record<string, string>,
  areaId: string,
  layerId: string,
): Promise<CachedLayerPayload | null> => {
  try {
    const { data } = await fs.readFile({
      path: `data/${areaId}/${layerId}.json`,
      directory: dir.Data,
      encoding: "utf8",
    });
    return JSON.parse(data) as CachedLayerPayload;
  } catch {
    return null;
  }
};

/**
 * Resolve the cached features under a WGS84 point across the requested layers.
 * Walks every downloaded area covering the point (usually one) and returns the
 * first containing feature per layer id, in the order layers were requested.
 * Empty array off-Capacitor, on no coverage, or on no hit.
 */
export async function resolveOfflineFeaturesAtPoint(
  lon: number,
  lat: number,
  layerIds: readonly string[],
): Promise<OfflineFeatureHit[]> {
  if (!isCapacitor()) return [];
  const areas = listDownloadedAreas().filter((a) => areaContainsPoint(a, lon, lat));
  if (areas.length === 0) return [];

  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const fs = Filesystem as unknown as MinimalFsRead;
  const dir = Directory as unknown as Record<string, string>;

  const hits: OfflineFeatureHit[] = [];
  const resolved = new Set<string>();
  for (const layerId of layerIds) {
    for (const area of areas) {
      if (resolved.has(layerId)) break;
      const payload = await readCachedLayer(fs, dir, area.id, layerId);
      if (!payload) continue;
      const hit = await pointInCachedFeatures(lon, lat, payload.features);
      if (hit) {
        hits.push({ layerId, attributes: hit.attributes, truncated: payload.truncated });
        resolved.add(layerId);
      }
    }
  }
  return hits;
}
