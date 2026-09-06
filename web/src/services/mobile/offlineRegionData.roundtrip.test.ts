/**
 * @file offlineRegionData.roundtrip.test.ts
 * @module engage-mt/services/mobile
 * @description Device-path integration test for the offline region-data feature.
 *              The write side (vectorDownloader) and read side
 *              (offlineDataResolver) are Capacitor-only, so the other unit
 *              suites cover just the web no-op. This test stands an in-memory
 *              @capacitor/filesystem in front of BOTH and drives the full
 *              round-trip: downloadRegionData persists the AOI-clipped features
 *              to disk → offlineDataResolver reads them back and resolves a point
 *              via the real bbox-containment + point-in-polygon logic. Exercises
 *              the JSON serialize/parse, the per-area manifest, the filesystem
 *              paths, and listDownloadedAreas (from localStorage) end to end.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

/** One shared in-memory filesystem behind the Capacitor mock (write + read). */
const files = new Map<string, string>();
const fsMock = {
  writeFile: async ({ path, data }: { path: string; data: string }) => {
    files.set(path, data);
  },
  readFile: async ({ path }: { path: string }) => {
    if (!files.has(path)) throw new Error(`ENOENT: ${path}`);
    return { data: files.get(path)! };
  },
};

vi.mock("@capacitor/filesystem", () => ({ Filesystem: fsMock, Directory: { Data: "DATA" } }));
vi.mock("@/utils/capacitor", () => ({ isCapacitor: () => true }));

// The downloader's network fetch is mocked; the resolver runs for real.
const fetchLayerFeaturesInBbox = vi.fn();
vi.mock("./regionDataCache", () => ({
  fetchLayerFeaturesInBbox: (...args: unknown[]) => fetchLayerFeaturesInBbox(...args),
}));

import { downloadRegionData } from "./vectorDownloader";
import { resolveOfflineFeaturesAtPoint } from "./offlineDataResolver";

const AREA_ID = "area_roundtrip";
const BBOX = { north: 46, south: 45, east: -110, west: -111 };
const LAYERS = [{ layerId: "mt-cadastral", label: "Land ownership" }];

// A polygon square filling the AOI, [lon,lat] rings — contains the test point.
const cadastralFeature = {
  attributes: { OwnerName: "TEST RANCH LLC", PropType: "Private" },
  rings: [
    [
      [-111, 45],
      [-110, 45],
      [-110, 46],
      [-111, 46],
      [-111, 45],
    ],
  ],
};

beforeEach(() => {
  files.clear();
  fetchLayerFeaturesInBbox.mockReset();
  window.localStorage.clear();
});

describe("offline region-data round-trip (device paths, in-memory FS)", () => {
  it("captures AOI features to disk, then resolves a point offline from that cache", async () => {
    fetchLayerFeaturesInBbox.mockResolvedValue({
      layerId: "mt-cadastral",
      features: [cadastralFeature],
      truncated: false,
    });

    // 1. WRITE — download the region's vector data.
    const progress = await downloadRegionData({ areaId: AREA_ID, bbox: BBOX, layers: LAYERS });
    expect(progress.fetchedLayers).toBe(1);
    expect(progress.failedLayers).toBe(0);
    // The layer file + a manifest landed on the (in-memory) disk.
    expect(files.has(`data/${AREA_ID}/mt-cadastral.json`)).toBe(true);
    expect(files.has(`data/${AREA_ID}/manifest.json`)).toBe(true);

    // 2. The downloaded area is registered the way the tile resolver reads it.
    window.localStorage.setItem(
      "engage-mt:offline-areas",
      JSON.stringify([{ id: AREA_ID, bbox: BBOX, maxZoom: 14, status: "downloaded" }]),
    );

    // 3. READ — tap a point inside the AOI, offline.
    const hits = await resolveOfflineFeaturesAtPoint(-110.5, 45.5, ["mt-cadastral"]);
    expect(hits).toHaveLength(1);
    expect(hits[0].layerId).toBe("mt-cadastral");
    expect(hits[0].attributes.OwnerName).toBe("TEST RANCH LLC");
  });

  it("returns no hit for a point outside the cached features", async () => {
    fetchLayerFeaturesInBbox.mockResolvedValue({
      layerId: "mt-cadastral",
      features: [cadastralFeature],
      truncated: false,
    });
    await downloadRegionData({ areaId: AREA_ID, bbox: BBOX, layers: LAYERS });
    window.localStorage.setItem(
      "engage-mt:offline-areas",
      JSON.stringify([{ id: AREA_ID, bbox: BBOX, maxZoom: 14, status: "downloaded" }]),
    );

    // Inside the downloaded AREA bbox but the feature ring doesn't cover it:
    // shrink the search to a point the square still contains → still hits, so
    // instead assert a point outside the AREA entirely returns nothing.
    const hits = await resolveOfflineFeaturesAtPoint(-100, 30, ["mt-cadastral"]);
    expect(hits).toEqual([]);
  });

  it("resume skips a layer already recorded in the manifest", async () => {
    fetchLayerFeaturesInBbox.mockResolvedValue({
      layerId: "mt-cadastral",
      features: [cadastralFeature],
      truncated: false,
    });
    await downloadRegionData({ areaId: AREA_ID, bbox: BBOX, layers: LAYERS });
    expect(fetchLayerFeaturesInBbox).toHaveBeenCalledTimes(1);

    // Second run with the manifest already on disk → the layer is skipped.
    await downloadRegionData({ areaId: AREA_ID, bbox: BBOX, layers: LAYERS });
    expect(fetchLayerFeaturesInBbox).toHaveBeenCalledTimes(1);
  });
});
