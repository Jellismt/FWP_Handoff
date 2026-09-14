/**
 * @file offlineTileResolver.test.ts
 * @module engage-mt/services/mobile
 * @description Index parsing, legacy zoom defaults, point and tile coverage,
 *              and nearest-area lookup on the web (no filesystem).
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
  areaCoversTile,
  areaCoveringPoint,
  hasAnyDownloadedCoverage,
  listDownloadedAreas,
  nearestDownloadedArea,
  resolveOfflineTile,
} from "./offlineTileResolver";
import { latToTileY, lonToTileX } from "./tileMath";

const KEY = "engage-mt:offline-areas";
const BOX = { north: 46, south: 45, east: -111, west: -112 };
const seed = (areas: Array<Record<string, unknown>>): void =>
  window.localStorage.setItem(KEY, JSON.stringify(areas));

describe("offlineTileResolver", () => {
  beforeEach(() => window.localStorage.removeItem(KEY));

  it("returns no coverage when nothing is persisted or the index is corrupt", () => {
    expect(hasAnyDownloadedCoverage()).toBe(false);
    window.localStorage.setItem(KEY, "{not-json");
    expect(listDownloadedAreas()).toEqual([]);
  });

  it("lists only downloaded areas and defaults legacy areas to the detail floor", () => {
    seed([
      { id: "a1", bbox: BOX, maxZoom: 14, status: "downloading" },
      { id: "a2", label: "Elk camp", bbox: BOX, minZoom: 6, maxZoom: 14, status: "downloaded" },
      { id: "a3", bbox: BOX, maxZoom: 12, status: "downloaded" },
    ]);
    const areas = listDownloadedAreas();
    expect(areas.map((a) => a.id)).toEqual(["a2", "a3"]);
    expect(areas[0].label).toBe("Elk camp");
    expect(areas[0].minZoom).toBe(6);
    expect(areas[1].minZoom).toBe(10);
    expect(areas[1].label).toBe("Downloaded area");
  });

  it("covers tiles only inside the area's zoom range and footprint", () => {
    const area = { id: "a", label: "a", bbox: BOX, minZoom: 6, maxZoom: 12 };
    const inside = (z: number) => [lonToTileX(-111.5, z), latToTileY(45.5, z)] as const;
    expect(areaCoversTile(area, 6, ...inside(6))).toBe(true);
    expect(areaCoversTile(area, 12, ...inside(12))).toBe(true);
    expect(areaCoversTile(area, 13, ...inside(13))).toBe(false);
    expect(areaCoversTile(area, 5, ...inside(5))).toBe(false);
    expect(areaCoversTile(area, 8, lonToTileX(-30, 8), latToTileY(40, 8))).toBe(false);
  });

  it("finds the area covering a point and the nearest area otherwise", () => {
    seed([
      { id: "west", label: "West", bbox: BOX, minZoom: 6, maxZoom: 14, status: "downloaded" },
      {
        id: "east",
        label: "East",
        bbox: { north: 46, south: 45, east: -104, west: -105 },
        minZoom: 6,
        maxZoom: 14,
        status: "downloaded",
      },
    ]);
    expect(areaCoveringPoint(-111.5, 45.5)?.id).toBe("west");
    expect(areaCoveringPoint(-108, 45.5)).toBeNull();
    expect(nearestDownloadedArea(-106, 45.5)?.id).toBe("east");
    expect(nearestDownloadedArea(-110, 45.5)?.id).toBe("west");
  });

  it("never resolves tiles on the web", async () => {
    seed([{ id: "a1", bbox: BOX, minZoom: 6, maxZoom: 14, status: "downloaded" }]);
    await expect(resolveOfflineTile(12, 800, 1500)).resolves.toEqual([]);
  });
});
