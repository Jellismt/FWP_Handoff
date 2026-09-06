/**
 * @file vectorDownloader.test.ts
 * @module engage-mt/services/mobile
 * @description Unit tests for the region vector-data downloader. Focuses on the
 *              web no-op guarantee (the offline pipeline is Capacitor-only) and
 *              the empty-layer-set short-circuit — the filesystem write path is
 *              device-only and exercised on the emulator.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const isCapacitor = vi.fn();
const fetchLayerFeaturesInBbox = vi.fn();

vi.mock("@/utils/capacitor", () => ({ isCapacitor: () => isCapacitor() }));
vi.mock("./regionDataCache", () => ({
  fetchLayerFeaturesInBbox: (...args: unknown[]) => fetchLayerFeaturesInBbox(...args),
}));

import { downloadRegionData } from "./vectorDownloader";

const BBOX = { north: 46, south: 45, east: -110, west: -111 };
const LAYERS = [
  { layerId: "mt-cadastral", label: "Land ownership" },
  { layerId: "hunting-districts", label: "Hunting districts" },
];

beforeEach(() => {
  isCapacitor.mockReset();
  fetchLayerFeaturesInBbox.mockReset();
});

describe("downloadRegionData", () => {
  it("is a no-op on web (no fetch, synthetic completion)", async () => {
    isCapacitor.mockReturnValue(false);
    const progress = await downloadRegionData({ areaId: "a1", bbox: BBOX, layers: LAYERS });
    expect(progress.percent).toBe(100);
    expect(progress.fetchedLayers).toBe(LAYERS.length);
    expect(progress.failedLayers).toBe(0);
    // The web path must never touch the network.
    expect(fetchLayerFeaturesInBbox).not.toHaveBeenCalled();
  });

  it("short-circuits an empty layer set to complete", async () => {
    isCapacitor.mockReturnValue(true);
    const progress = await downloadRegionData({ areaId: "a1", bbox: BBOX, layers: [] });
    expect(progress.percent).toBe(100);
    expect(progress.totalLayers).toBe(0);
    expect(fetchLayerFeaturesInBbox).not.toHaveBeenCalled();
  });
});
