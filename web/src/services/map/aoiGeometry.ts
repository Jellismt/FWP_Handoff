/**
 * @file aoiGeometry.ts
 * @module engage-mt/services/map
 * @description Pure geometry helpers for the offline-map Area-of-Interest (AOI)
 *              selection: derive a north/south/east/west bbox from two arbitrary
 *              corner points (drawn in either order) and flag degenerate
 *              (zero-area) selections. No ArcGIS dependency so it is trivially
 *              unit-testable.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-06-30
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** A [longitude, latitude] pair in WGS84 degrees. */
export type LonLat = [number, number];

/** The bbox shape consumed by the tile downloader + size estimator. */
export interface AoiBbox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Build a normalized bbox from two corner points. Corner order does not matter —
 * the result always has north ≥ south and east ≥ west. Antimeridian wrap is not
 * a concern for Montana (the app is state-scoped), so a simple min/max suffices.
 */
export const bboxFromCorners = (a: LonLat, b: LonLat): AoiBbox => ({
  north: Math.max(a[1], b[1]),
  south: Math.min(a[1], b[1]),
  east: Math.max(a[0], b[0]),
  west: Math.min(a[0], b[0]),
});

/**
 * True when a bbox has effectively no area in either dimension — e.g. the user
 * tapped the same point twice. Callers should reject these rather than queue a
 * zero-tile download.
 */
export const isDegenerateBbox = (bbox: AoiBbox, epsilon = 1e-6): boolean =>
  Math.abs(bbox.north - bbox.south) < epsilon || Math.abs(bbox.east - bbox.west) < epsilon;

/**
 * The closed [lon, lat] ring (NW → NE → SE → SW → NW) for a bbox, suitable for
 * an ArcGIS Polygon's `rings`. Shared by the draw helper and the in-page picker
 * so the rectangle geometry is defined in exactly one place.
 */
export const bboxRing = (bbox: AoiBbox): number[][] => [
  [bbox.west, bbox.north],
  [bbox.east, bbox.north],
  [bbox.east, bbox.south],
  [bbox.west, bbox.south],
  [bbox.west, bbox.north],
];
