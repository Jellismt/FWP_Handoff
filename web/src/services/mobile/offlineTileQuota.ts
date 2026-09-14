/**
 * @file offlineTileQuota.ts
 * @module engage-mt/services/mobile
 * @description Offline storage budget and size estimates: the device cap
 *              (2 GiB by default, overridable through localStorage), a rolling
 *              bytes-per-tile average calibrated from real downloads, and one
 *              `estimateAreaBytes` every offline surface uses so the sheet,
 *              the page, and the store agree on a number.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { OFFLINE_FLOOR_MIN_ZOOM } from "@/config/offlineBasemaps";
import { countTiles, type BBox } from "./tileMath";

/** USGS tiles average about 24 KB (PNG topo, JPEG imagery). */
const DEFAULT_BYTES_PER_TILE = 24_000;
export const DEFAULT_OFFLINE_MAX_BYTES = 2 * 1024 ** 3;
const STORAGE_CAP_KEY = "engage-mt:offline-storage-cap-bytes";
const TILE_SIZE_SAMPLES_KEY = "engage-mt:offline-tile-size-samples";
const MAX_SAMPLES = 8;
/** Land ownership, districts, and boundaries per square kilometre of area. */
const VECTOR_BYTES_PER_SQKM = 30_000;

const readNumber = (key: string): number | null => {
  try {
    const raw = window.localStorage?.getItem?.(key);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
};

const readSamples = (): number[] => {
  try {
    const raw = window.localStorage?.getItem?.(TILE_SIZE_SAMPLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n: unknown): n is number => typeof n === "number" && Number.isFinite(n));
  } catch {
    return [];
  }
};

const writeSamples = (samples: number[]): void => {
  try {
    window.localStorage?.setItem?.(TILE_SIZE_SAMPLES_KEY, JSON.stringify(samples));
  } catch {
    /* storage unavailable */
  }
};

/** Read on every call so an override set in this session applies immediately. */
export const offlineMaxBytes = (): number =>
  readNumber(STORAGE_CAP_KEY) ?? DEFAULT_OFFLINE_MAX_BYTES;

export const recordTileSizeSample = (bytesPerTile: number): void => {
  if (!Number.isFinite(bytesPerTile) || bytesPerTile <= 0) return;
  const samples = readSamples();
  samples.push(bytesPerTile);
  while (samples.length > MAX_SAMPLES) samples.shift();
  writeSamples(samples);
};

export const averageBytesPerTile = (): number => {
  const samples = readSamples();
  if (samples.length === 0) return DEFAULT_BYTES_PER_TILE;
  return Math.round(samples.reduce((acc, n) => acc + n, 0) / samples.length);
};

export const estimateTileBytes = (input: BBox & { minZoom?: number; maxZoom: number }): number =>
  countTiles(input, input.minZoom ?? OFFLINE_FLOOR_MIN_ZOOM, input.maxZoom) * averageBytesPerTile();

export const estimateVectorBytes = (bbox: BBox): number => {
  const latRange = Math.max(0.0001, bbox.north - bbox.south);
  const lonRange = Math.max(0.0001, bbox.east - bbox.west);
  const midLat = (bbox.north + bbox.south) / 2;
  const KM_PER_DEG_LAT = 111;
  const kmPerDegLon = KM_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);
  return Math.round(latRange * KM_PER_DEG_LAT * lonRange * kmPerDegLon * VECTOR_BYTES_PER_SQKM);
};

export interface AreaEstimate {
  tileCount: number;
  tileBytes: number;
  dataBytes: number;
  totalBytes: number;
}

/** Both download legs for an area: raster tiles plus the region's vector data. */
export const estimateAreaBytes = (
  bbox: BBox,
  maxZoom: number,
  minZoom: number = OFFLINE_FLOOR_MIN_ZOOM,
): AreaEstimate => {
  const tileCount = countTiles(bbox, minZoom, maxZoom);
  const tileBytes = tileCount * averageBytesPerTile();
  const dataBytes = estimateVectorBytes(bbox);
  return { tileCount, tileBytes, dataBytes, totalBytes: tileBytes + dataBytes };
};

export const formatBytes = (b: number): string => {
  if (b < 1_000_000) return `${(b / 1_000).toFixed(0)} KB`;
  if (b < 1_000_000_000) return `${(b / 1_000_000).toFixed(0)} MB`;
  return `${(b / 1_000_000_000).toFixed(1)} GB`;
};
