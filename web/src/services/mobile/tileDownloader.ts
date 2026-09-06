/**
 * @file tileDownloader.ts
 * @module engage-mt/services/mobile
 * @description Downloads the raster tiles for an offline area to the device
 *              filesystem, resuming from a per-area manifest. Every pack
 *              includes the overview levels down to `minZoom` so the map keeps
 *              drawing when the user zooms out. A manifest written for a
 *              different tile source is ignored so the area restarts cleanly.
 *              On the web the call is a no-op that reports completion.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createLogger } from "@/utils/logger";
import { isCapacitor } from "@/utils/capacitor";
import { recordTileSizeSample } from "./offlineTileQuota";
import { enumerateTiles, fillTemplate, tileKey, type BBox } from "./tileMath";

const log = createLogger("tile-downloader");
const MAX_CONCURRENT = 4;
const PROGRESS_EVERY = 8;

export type { BBox } from "./tileMath";

/** USGS Topo serves PNG; USGS Imagery Topo serves JPEG. */
export type TileExtension = "png" | "jpg";

export interface DownloadProgress {
  fetched: number;
  total: number;
  failed: number;
  /** Bytes written to disk for this area, including earlier runs. */
  bytes: number;
  percent: number;
}

export interface TileManifest {
  areaId: string;
  urlTemplate?: string;
  /** Extension the tiles were written with. Absent on areas saved by earlier builds. */
  tileExtension?: TileExtension;
  minZoom?: number;
  maxZoom?: number;
  completedAt?: string;
  fetched: number;
  total: number;
  failed: number;
  bytes: number;
  /** "z/x/y" keys for every tile on disk. */
  completedTiles: string[];
}

export interface TileDownloaderOptions {
  areaId: string;
  bbox: BBox;
  /** XYZ template, e.g. "https://server.example/{z}/{y}/{x}". */
  urlTemplate: string;
  minZoom: number;
  maxZoom: number;
  /** Format this source serves, so the file on disk carries the honest extension. */
  tileExtension: TileExtension;
  signal?: AbortSignal;
  onProgress?: (p: DownloadProgress) => void;
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

/**
 * The filesystem plugin decides how to treat `data` from the presence of
 * `encoding`: absent means "this is base64, decode it to bytes", present means
 * "this is text". Passing JSON with no encoding makes the plugin try to
 * base64-decode it and reject, which silently loses the manifest. These two
 * helpers make the choice explicit at every call site so it cannot be missed.
 */
const writeBytes = (
  fs: MinimalFilesystem,
  dir: Record<string, string>,
  path: string,
  base64: string,
): Promise<unknown> => fs.writeFile({ path, data: base64, directory: dir.Data, recursive: true });

const writeText = (
  fs: MinimalFilesystem,
  dir: Record<string, string>,
  path: string,
  text: string,
): Promise<unknown> =>
  fs.writeFile({ path, data: text, directory: dir.Data, encoding: "utf8", recursive: true });

export const tilePath = (
  areaId: string,
  z: number,
  x: number,
  y: number,
  extension: TileExtension = "png",
): string => `tiles/${areaId}/${z}/${x}/${y}.${extension}`;
const manifestPath = (areaId: string): string => `tiles/${areaId}/manifest.json`;

/** Base64 without building one giant argument list (tiles run to hundreds of KB). */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

const mapConcurrent = async <T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> => {
  let index = 0;
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, items.length) }).map(async () => {
    while (index < items.length) {
      if (signal?.aborted) return;
      const i = index++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
};

const readManifest = async (
  fs: MinimalFilesystem,
  dir: Record<string, string>,
  areaId: string,
): Promise<TileManifest | null> => {
  if (!fs.readFile) return null;
  try {
    const { data } = await fs.readFile({
      path: manifestPath(areaId),
      directory: dir.Data,
      encoding: "utf8",
    });
    const parsed = JSON.parse(data) as Partial<TileManifest>;
    if (!parsed || typeof parsed !== "object") return null;
    const num = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) ? n : 0);
    return {
      areaId: parsed.areaId ?? areaId,
      urlTemplate: typeof parsed.urlTemplate === "string" ? parsed.urlTemplate : undefined,
      tileExtension:
        parsed.tileExtension === "jpg" || parsed.tileExtension === "png"
          ? parsed.tileExtension
          : undefined,
      minZoom: typeof parsed.minZoom === "number" ? parsed.minZoom : undefined,
      maxZoom: typeof parsed.maxZoom === "number" ? parsed.maxZoom : undefined,
      completedAt: parsed.completedAt,
      fetched: num(parsed.fetched),
      total: num(parsed.total),
      failed: num(parsed.failed),
      bytes: num(parsed.bytes),
      completedTiles: Array.isArray(parsed.completedTiles)
        ? parsed.completedTiles.filter((s): s is string => typeof s === "string")
        : [],
    };
  } catch {
    return null;
  }
};

export const downloadArea = async (opts: TileDownloaderOptions): Promise<DownloadProgress> => {
  const tiles = enumerateTiles(opts.bbox, opts.minZoom, opts.maxZoom);
  const progress: DownloadProgress = {
    fetched: 0,
    total: tiles.length,
    failed: 0,
    bytes: 0,
    percent: 0,
  };
  const report = (): void => {
    progress.percent = Math.round(
      ((progress.fetched + progress.failed) / Math.max(1, progress.total)) * 100,
    );
    opts.onProgress?.(progress);
  };

  if (!isCapacitor()) {
    log.info("Web preview — skipping tile writes", { areaId: opts.areaId, total: tiles.length });
    progress.fetched = tiles.length;
    report();
    return progress;
  }

  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const fs = Filesystem as unknown as MinimalFilesystem;
  const dir = Directory as unknown as Record<string, string>;

  // Resume only from a manifest written for the same tile source; anything
  // else (an earlier build's source, a changed basemap) starts over.
  const prior = await readManifest(fs, dir, opts.areaId);
  const resumable = prior !== null && prior.urlTemplate === opts.urlTemplate;
  const completedTiles = new Set<string>(resumable ? prior.completedTiles : []);
  if (resumable) {
    progress.fetched = completedTiles.size;
    progress.bytes = prior.bytes;
    log.info("Resuming download", {
      areaId: opts.areaId,
      alreadyDone: completedTiles.size,
      total: progress.total,
    });
    report();
  }

  let observedBytes = 0;
  let observedTiles = 0;
  let sinceReport = 0;

  await mapConcurrent(
    tiles,
    async ({ z, x, y }) => {
      if (opts.signal?.aborted) return;
      const key = tileKey(z, x, y);
      if (completedTiles.has(key)) return;
      try {
        const res = await fetch(fillTemplate(opts.urlTemplate, z, x, y), { signal: opts.signal });
        if (!res.ok) {
          progress.failed += 1;
        } else {
          const bytes = new Uint8Array(await res.arrayBuffer());
          await writeBytes(
            fs,
            dir,
            tilePath(opts.areaId, z, x, y, opts.tileExtension),
            bytesToBase64(bytes),
          );
          completedTiles.add(key);
          progress.fetched += 1;
          progress.bytes += bytes.byteLength;
          observedBytes += bytes.byteLength;
          observedTiles += 1;
        }
      } catch {
        progress.failed += 1;
      }
      sinceReport += 1;
      if (sinceReport >= PROGRESS_EVERY) {
        sinceReport = 0;
        report();
      }
    },
    opts.signal,
  );

  try {
    const manifest: TileManifest = {
      areaId: opts.areaId,
      urlTemplate: opts.urlTemplate,
      tileExtension: opts.tileExtension,
      minZoom: opts.minZoom,
      maxZoom: opts.maxZoom,
      completedAt: new Date().toISOString(),
      fetched: progress.fetched,
      total: progress.total,
      failed: progress.failed,
      bytes: progress.bytes,
      completedTiles: Array.from(completedTiles),
    };
    await writeText(fs, dir, manifestPath(opts.areaId), JSON.stringify(manifest));
  } catch (err) {
    log.warn("Failed to write area manifest", {
      areaId: opts.areaId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (observedTiles > 0) recordTileSizeSample(observedBytes / observedTiles);
  report();
  return progress;
};

export const readAreaManifest = async (areaId: string): Promise<TileManifest | null> => {
  if (!isCapacitor()) return null;
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  return readManifest(
    Filesystem as unknown as MinimalFilesystem,
    Directory as unknown as Record<string, string>,
    areaId,
  );
};
