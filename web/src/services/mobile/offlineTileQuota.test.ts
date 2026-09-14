/**
 * @file offlineTileQuota.test.ts
 * @module engage-mt/services/mobile
 * @description Cap override, tile-size calibration window, and the shared
 *              area estimate.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_OFFLINE_MAX_BYTES,
  averageBytesPerTile,
  estimateAreaBytes,
  estimateTileBytes,
  formatBytes,
  offlineMaxBytes,
  recordTileSizeSample,
} from "./offlineTileQuota";
import { countTiles } from "./tileMath";

const HELENA = { north: 46.6, south: 46.5, east: -111.9, west: -112.0 };

describe("offlineTileQuota", () => {
  beforeEach(() => window.localStorage.clear());

  it("reads the cap override on every call and ignores junk", () => {
    expect(offlineMaxBytes()).toBe(DEFAULT_OFFLINE_MAX_BYTES);
    window.localStorage.setItem("engage-mt:offline-storage-cap-bytes", "500000000");
    expect(offlineMaxBytes()).toBe(500_000_000);
    window.localStorage.setItem("engage-mt:offline-storage-cap-bytes", "-1");
    expect(offlineMaxBytes()).toBe(DEFAULT_OFFLINE_MAX_BYTES);
  });

  it("falls back to the default tile size and averages recorded samples", () => {
    expect(averageBytesPerTile()).toBe(24_000);
    recordTileSizeSample(10_000);
    recordTileSizeSample(20_000);
    expect(averageBytesPerTile()).toBe(15_000);
  });

  it("keeps only the newest eight samples and ignores bad ones", () => {
    for (let i = 1; i <= 12; i += 1) recordTileSizeSample(i * 1_000);
    expect(averageBytesPerTile()).toBe(8_500);
    recordTileSizeSample(0);
    recordTileSizeSample(Number.NaN);
    expect(averageBytesPerTile()).toBe(8_500);
  });

  it("estimates tiles from the exact tile count over the floor levels", () => {
    expect(estimateTileBytes({ ...HELENA, maxZoom: 12 })).toBe(countTiles(HELENA, 6, 12) * 24_000);
    expect(estimateTileBytes({ ...HELENA, maxZoom: 14 })).toBeGreaterThan(
      estimateTileBytes({ ...HELENA, maxZoom: 10 }),
    );
  });

  it("estimateAreaBytes totals both legs", () => {
    const e = estimateAreaBytes(HELENA, 12);
    expect(e.tileCount).toBe(countTiles(HELENA, 6, 12));
    expect(e.totalBytes).toBe(e.tileBytes + e.dataBytes);
    expect(e.dataBytes).toBeGreaterThan(0);
  });

  it("formatBytes picks reasonable units", () => {
    expect(formatBytes(900)).toBe("1 KB");
    expect(formatBytes(2_500_000)).toBe("3 MB");
    expect(formatBytes(2_500_000_000)).toBe("2.5 GB");
  });
});
