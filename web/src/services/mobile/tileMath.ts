/**
 * @file tileMath.ts
 * @module engage-mt/services/mobile
 * @description Web Mercator (XYZ) tile arithmetic shared by the offline tile
 *              downloader, resolver, and size estimator: lon/lat to tile,
 *              tile to bounds, enumeration and counting of the tiles a box
 *              touches, and a tile/box intersection test.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TileRef {
  z: number;
  x: number;
  y: number;
}

const MAX_LAT = 85.0511;

const clampLat = (lat: number): number => Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));

export const lonToTileX = (lon: number, z: number): number =>
  Math.floor(((lon + 180) / 360) * 2 ** z);

export const latToTileY = (lat: number, z: number): number => {
  const r = (clampLat(lat) * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

export const tileXToLon = (x: number, z: number): number => (x / 2 ** z) * 360 - 180;

export const tileYToLat = (y: number, z: number): number => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

interface TileRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Inclusive tile index range a box touches at one zoom, clamped to the world. */
export const tileRange = (bbox: BBox, z: number): TileRange => {
  const last = 2 ** z - 1;
  const clamp = (n: number): number => Math.max(0, Math.min(last, n));
  const xs = [lonToTileX(bbox.west, z), lonToTileX(bbox.east, z)];
  const ys = [latToTileY(bbox.north, z), latToTileY(bbox.south, z)];
  return {
    minX: clamp(Math.min(...xs)),
    maxX: clamp(Math.max(...xs)),
    minY: clamp(Math.min(...ys)),
    maxY: clamp(Math.max(...ys)),
  };
};

export const countTiles = (bbox: BBox, minZoom: number, maxZoom: number): number => {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const r = tileRange(bbox, z);
    total += (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1);
  }
  return total;
};

export const enumerateTiles = (bbox: BBox, minZoom: number, maxZoom: number): TileRef[] => {
  const tiles: TileRef[] = [];
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const r = tileRange(bbox, z);
    for (let x = r.minX; x <= r.maxX; x += 1) {
      for (let y = r.minY; y <= r.maxY; y += 1) tiles.push({ z, x, y });
    }
  }
  return tiles;
};

export const tileBounds = (z: number, x: number, y: number): BBox => ({
  west: tileXToLon(x, z),
  east: tileXToLon(x + 1, z),
  north: tileYToLat(y, z),
  south: tileYToLat(y + 1, z),
});

/** True when any part of the tile lies inside the box (edges touching do not count). */
export const tileIntersectsBbox = (bbox: BBox, z: number, x: number, y: number): boolean => {
  const t = tileBounds(z, x, y);
  return t.west < bbox.east && t.east > bbox.west && t.south < bbox.north && t.north > bbox.south;
};

export const tileKey = (z: number, x: number, y: number): string => `${z}/${x}/${y}`;

export const fillTemplate = (template: string, z: number, x: number, y: number): string =>
  template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
