/**
 * @file offlineTileResolver.capacitor.test.ts
 * @module engage-mt/services/mobile
 * @description On the device, tiles resolve to URLs the web view serves from
 *              the app's data directory: one bridge call for the whole layer,
 *              the right extension per source, every covering area offered in
 *              order, and nothing claimed outside an area's zoom range.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-09-06
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getUri: vi.fn(async () => ({ uri: "file:///data/Documents/tiles" })),
  convertFileSrc: vi.fn((p: string) =>
    p.replace("file://", "capacitor://localhost/_capacitor_file_"),
  ),
}));
vi.mock("@/utils/capacitor", () => ({ isCapacitor: () => true }));
vi.mock("@capacitor/core", () => ({ Capacitor: { convertFileSrc: h.convertFileSrc } }));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { getUri: h.getUri },
  Directory: { Data: "DATA" },
}));

import { resetOfflineTileBaseUrl, resolveOfflineTile } from "./offlineTileResolver";
import { latToTileY, lonToTileX } from "./tileMath";

const KEY = "engage-mt:offline-areas";
const BOX = { north: 49, south: 44.5, east: -104, west: -116 };
const area = (over: Record<string, unknown> = {}) => ({
  id: "mt-west",
  label: "West",
  bbox: BOX,
  minZoom: 6,
  maxZoom: 12,
  basemap: "usgsTopo",
  status: "downloaded",
  ...over,
});
const seed = (areas: Array<Record<string, unknown>>): void =>
  window.localStorage.setItem(KEY, JSON.stringify(areas));

const tileIn = (z: number) => [z, lonToTileX(-112, z), latToTileY(46.6, z)] as const;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  resetOfflineTileBaseUrl();
  seed([area()]);
});

describe("resolveOfflineTile on the device", () => {
  it("serves a covered tile from the web view, not as a base64 data URL", async () => {
    const [z, x, y] = tileIn(8);
    await expect(resolveOfflineTile(z, x, y)).resolves.toEqual([
      `capacitor://localhost/_capacitor_file_/data/Documents/tiles/mt-west/${z}/${x}/${y}.png`,
    ]);
  });

  it("resolves the served base once for the whole layer", async () => {
    const [z, x, y] = tileIn(8);
    await resolveOfflineTile(z, x, y);
    await resolveOfflineTile(z, x + 1, y);
    await resolveOfflineTile(z, x + 2, y);
    expect(h.getUri).toHaveBeenCalledTimes(1);
    expect(h.convertFileSrc).toHaveBeenCalledTimes(1);
  });

  it("uses the extension the source actually serves", async () => {
    seed([area({ basemap: "usgsImageryTopo" })]);
    const [z, x, y] = tileIn(8);
    await expect(resolveOfflineTile(z, x, y)).resolves.toEqual([
      `capacitor://localhost/_capacitor_file_/data/Documents/tiles/mt-west/${z}/${x}/${y}.jpg`,
    ]);
  });

  it("offers every covering area so a tile missing from one can come from another", async () => {
    seed([area(), area({ id: "second", label: "Second" })]);
    const [z, x, y] = tileIn(8);
    const urls = await resolveOfflineTile(z, x, y);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("/mt-west/");
    expect(urls[1]).toContain("/second/");
  });

  it("claims nothing outside the area's zoom range or footprint", async () => {
    await expect(resolveOfflineTile(...tileIn(13))).resolves.toEqual([]);
    await expect(resolveOfflineTile(...tileIn(5))).resolves.toEqual([]);
    const z = 8;
    await expect(resolveOfflineTile(z, lonToTileX(-30, z), latToTileY(40, z))).resolves.toEqual([]);
    expect(h.getUri).not.toHaveBeenCalled();
  });

  it("claims nothing when the served base cannot be resolved", async () => {
    h.getUri.mockRejectedValueOnce(new Error("no such directory"));
    await expect(resolveOfflineTile(...tileIn(8))).resolves.toEqual([]);
  });
});
