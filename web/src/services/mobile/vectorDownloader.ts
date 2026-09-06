/**
 * @file vectorDownloader.ts
 * @module engage-mt/services/mobile
 * @description Downloads the curated offline-data layers' vector features for a
 *              drawn AOI and writes them to @capacitor/filesystem under
 *              Data/data/{areaId}/{layerId}.json, so offline tap-to-identify can
 *              answer "whose land / what district" with no signal. The vector
 *              companion to `tileDownloader` — same filesystem + per-area
 *              manifest + resume + abort shape, but the payload is Esri-rings
 *              JSON (text) rather than base64 tile images.
 *
 *              Resumable: a per-area manifest at Data/data/{areaId}/manifest.json
 *              records which layers are already cached; on re-entry completed
 *              layers are skipped. Web is a no-op (returns synthetic completion),
 *              mirroring the tile downloader — the offline pipeline is
 *              Capacitor-only.
 *
 *              Privacy: the bbox is user-selected; only public layer geometry is
 *              fetched. Per `docs/rules/privacy.md`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createLogger } from "@/utils/logger";
import { isCapacitor } from "@/utils/capacitor";
import { fetchLayerFeaturesInBbox, type RegionBbox, type RegionFeature } from "./regionDataCache";
import type { OfflineDataLayer } from "@/config/offlineDataLayers";

const log = createLogger("vector-downloader");

export interface RegionDataProgress {
  fetchedLayers: number;
  totalLayers: number;
  failedLayers: number;
  /** Bytes written to disk across all cached layers this area. */
  bytes: number;
  percent: number;
}

/** On-disk per-layer cache file shape (read back by offlineDataResolver). */
export interface CachedLayerPayload {
  layerId: string;
  fetchedAt: string;
  truncated: boolean;
  features: RegionFeature[];
}

interface ManifestLayerEntry {
  layerId: string;
  featureCount: number;
  bytes: number;
  truncated: boolean;
}

export interface RegionDataManifest {
  areaId: string;
  completedAt?: string;
  layers: ManifestLayerEntry[];
}

export interface VectorDownloaderOptions {
  areaId: string;
  bbox: RegionBbox;
  layers: readonly OfflineDataLayer[];
  signal?: AbortSignal;
  onProgress?: (p: RegionDataProgress) => void;
}

interface MinimalFilesystem {
  writeFile: (opts: {
    path: string;
    data: string;
    directory: string;
    encoding?: string;
    recursive?: boolean;
  }) => Promise<unknown>;
  readFile?: (opts: { path: string; directory: string; encoding?: string }) => Promise<{
    data: string;
  }>;
}

const manifestPath = (areaId: string): string => `data/${areaId}/manifest.json`;
const layerPath = (areaId: string, layerId: string): string => `data/${areaId}/${layerId}.json`;

const readManifest = async (
  fs: MinimalFilesystem,
  dir: Record<string, string>,
  areaId: string,
): Promise<RegionDataManifest | null> => {
  if (!fs.readFile) return null;
  try {
    const { data } = await fs.readFile({
      path: manifestPath(areaId),
      directory: dir.Data,
      encoding: "utf8",
    });
    const parsed = JSON.parse(data) as Partial<RegionDataManifest>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      areaId: parsed.areaId ?? areaId,
      completedAt: parsed.completedAt,
      layers: Array.isArray(parsed.layers) ? parsed.layers : [],
    };
  } catch {
    return null;
  }
};

/**
 * Fetch + persist every curated layer's AOI-clipped features. Returns once each
 * layer is cached, skipped (already on disk), or recorded as failed. On web it
 * writes nothing and reports synthetic completion.
 */
export const downloadRegionData = async (
  opts: VectorDownloaderOptions,
): Promise<RegionDataProgress> => {
  const progress: RegionDataProgress = {
    fetchedLayers: 0,
    totalLayers: opts.layers.length,
    failedLayers: 0,
    bytes: 0,
    percent: 0,
  };

  if (progress.totalLayers === 0) {
    progress.percent = 100;
    opts.onProgress?.(progress);
    return progress;
  }

  if (!isCapacitor()) {
    log.info("Web preview — skipping region-data writes", {
      areaId: opts.areaId,
      layers: progress.totalLayers,
    });
    progress.fetchedLayers = progress.totalLayers;
    progress.percent = 100;
    opts.onProgress?.(progress);
    return progress;
  }

  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const fs = Filesystem as unknown as MinimalFilesystem;
  const dir = Directory as unknown as Record<string, string>;

  const prior = await readManifest(fs, dir, opts.areaId);
  const done = new Map<string, ManifestLayerEntry>(
    (prior?.layers ?? []).map((l) => [l.layerId, l]),
  );
  // Seed progress from prior run so a resume shows accurate counts.
  for (const entry of done.values()) {
    progress.fetchedLayers += 1;
    progress.bytes += entry.bytes;
  }
  progress.percent = Math.round((progress.fetchedLayers / progress.totalLayers) * 100);

  for (const layer of opts.layers) {
    if (opts.signal?.aborted) break;
    if (done.has(layer.layerId)) continue;

    const result = await fetchLayerFeaturesInBbox(layer.layerId, opts.bbox, {
      signal: opts.signal,
    });
    if (!result) {
      progress.failedLayers += 1;
      progress.percent = Math.round(
        ((progress.fetchedLayers + progress.failedLayers) / progress.totalLayers) * 100,
      );
      opts.onProgress?.(progress);
      continue;
    }

    const payload: CachedLayerPayload = {
      layerId: result.layerId,
      fetchedAt: new Date().toISOString(),
      truncated: result.truncated,
      features: result.features,
    };
    const serialized = JSON.stringify(payload);
    try {
      await fs.writeFile({
        path: layerPath(opts.areaId, layer.layerId),
        data: serialized,
        directory: dir.Data,
        encoding: "utf8",
        recursive: true,
      });
      const entry: ManifestLayerEntry = {
        layerId: layer.layerId,
        featureCount: result.features.length,
        // Byte length of the UTF-8 payload; close enough for the storage readout.
        bytes: serialized.length,
        truncated: result.truncated,
      };
      done.set(layer.layerId, entry);
      progress.fetchedLayers += 1;
      progress.bytes += entry.bytes;
    } catch (err) {
      progress.failedLayers += 1;
      log.warn("Region-layer write failed", {
        layerId: layer.layerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    progress.percent = Math.round(
      ((progress.fetchedLayers + progress.failedLayers) / progress.totalLayers) * 100,
    );
    opts.onProgress?.(progress);
  }

  // Persist the manifest so a future resume knows which layers are cached.
  try {
    const manifest: RegionDataManifest = {
      areaId: opts.areaId,
      completedAt: new Date().toISOString(),
      layers: Array.from(done.values()),
    };
    await fs.writeFile({
      path: manifestPath(opts.areaId),
      data: JSON.stringify(manifest),
      directory: dir.Data,
      encoding: "utf8",
      recursive: true,
    });
  } catch (err) {
    log.warn("Failed to write region-data manifest", {
      areaId: opts.areaId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  opts.onProgress?.(progress);
  return progress;
};
