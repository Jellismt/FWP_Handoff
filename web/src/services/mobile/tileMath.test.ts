/**
 * @file tileMath.test.ts
 * @module engage-mt/services/mobile
 * @description Tile arithmetic: conversions round-trip, counting matches
 *              enumeration, ranges clamp to the world, and the intersection
 *              test agrees with tile bounds.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import {
  countTiles,
  enumerateTiles,
  fillTemplate,
  latToTileY,
  lonToTileX,
  tileBounds,
  tileIntersectsBbox,
  tileRange,
  tileXToLon,
  tileYToLat,
} from "./tileMath";

const HELENA = { north: 46.6, south: 46.5, east: -111.9, west: -112.0 };

describe("tileMath", () => {
  it("converts longitude and latitude to tile indices", () => {
    expect(lonToTileX(-180, 0)).toBe(0);
    expect(lonToTileX(0, 4)).toBe(8);
    expect(lonToTileX(112.5, 4)).toBe(13);
    expect(latToTileY(0, 1)).toBe(1);
    expect(latToTileY(46.59, 4)).toBe(5);
  });

  it("round-trips tile origins through lon/lat", () => {
    const z = 10;
    const x = lonToTileX(-112, z);
    const y = latToTileY(46.6, z);
    expect(lonToTileX(tileXToLon(x, z), z)).toBe(x);
    expect(latToTileY(tileYToLat(y, z) - 1e-9, z)).toBe(y);
  });

  it("counts exactly what it enumerates", () => {
    expect(countTiles(HELENA, 6, 12)).toBe(enumerateTiles(HELENA, 6, 12).length);
    expect(enumerateTiles(HELENA, 10, 10).every((t) => t.z === 10)).toBe(true);
  });

  it("grows roughly 4x per zoom level for a box larger than a tile", () => {
    const box = { north: 47, south: 46, east: -111, west: -113 };
    expect(countTiles(box, 11, 11) / countTiles(box, 10, 10)).toBeGreaterThan(3);
    expect(countTiles(box, 11, 11) / countTiles(box, 10, 10)).toBeLessThan(5);
  });

  it("clamps ranges to the world and tolerates polar latitudes", () => {
    const world = { north: 90, south: -90, east: 180, west: -180 };
    expect(tileRange(world, 1)).toEqual({ minX: 0, maxX: 1, minY: 0, maxY: 1 });
    expect(countTiles(world, 0, 2)).toBe(1 + 4 + 16);
  });

  it("tile bounds intersect the box they were enumerated for", () => {
    for (const t of enumerateTiles(HELENA, 8, 11)) {
      expect(tileIntersectsBbox(HELENA, t.z, t.x, t.y)).toBe(true);
    }
    const atlantic = { z: 6, x: lonToTileX(-30, 6), y: latToTileY(40, 6) };
    expect(tileIntersectsBbox(HELENA, atlantic.z, atlantic.x, atlantic.y)).toBe(false);
    const b = tileBounds(6, atlantic.x, atlantic.y);
    expect(b.west).toBeLessThan(-30);
    expect(b.east).toBeGreaterThan(-30);
  });

  it("fills an XYZ template", () => {
    expect(fillTemplate("https://h/{z}/{y}/{x}", 3, 1, 2)).toBe("https://h/3/2/1");
  });
});
