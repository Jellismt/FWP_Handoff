/**
 * @file geometry.ts
 * @module engage-mt/utils
 * @description Small math helpers used by features that compute distance / area
 *              from arrays of [lon, lat] vertices without going through ArcGIS's
 *              geometryEngine. Match the same formulas trackRecorder uses for
 *              cumulative track distance so the user sees consistent numbers
 *              whether a path was recorded by GPS or typed in by hand.
 *
 *              For polygon area at Montana's latitude band the planar Shoelace
 *              with a longitude-scale correction is within ~0.5% of WGS-84 truth
 *              for polygons up to ~50 mi across; plenty accurate for "what's the
 *              size of this glassing parcel" use cases.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

const EARTH_RADIUS_M = 6_371_000;
export const MILES_PER_METER = 0.000621371;
export const ACRES_PER_SQ_METER = 0.000247105;
const METERS_PER_DEGREE_LAT = 111_132;

const toRad = (d: number): number => (d * Math.PI) / 180;

/** Great-circle distance between two [lon, lat] points, in meters. */
export const haversineMeters = (lon1: number, lat1: number, lon2: number, lat2: number): number => {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
};

/** Sum of segment lengths along an open polyline, in meters. */
export const polylineLengthMeters = (
  vertices: ReadonlyArray<readonly [number, number]>,
): number => {
  let total = 0;
  for (let i = 1; i < vertices.length; i += 1) {
    const [lon1, lat1] = vertices[i - 1];
    const [lon2, lat2] = vertices[i];
    total += haversineMeters(lon1, lat1, lon2, lat2);
  }
  return total;
};

/**
 * Planar Shoelace polygon area with per-vertex longitude scaling so meters east
 * vs. meters north stay roughly equal. Accurate enough at Montana's latitudes
 * (44–49°N) for any polygon a hunter or angler would type by hand. Returns
 * square meters. Vertices are [lon, lat]; the polygon is auto-closed.
 */
export const polygonAreaSqMeters = (vertices: ReadonlyArray<readonly [number, number]>): number => {
  if (vertices.length < 3) return 0;
  // Project each vertex into a local equirectangular plane centered on the
  // polygon's mean latitude so the longitude scale doesn't get squished.
  const meanLat = vertices.reduce((s, [, lat]) => s + lat, 0) / vertices.length;
  const cosLat = Math.cos(toRad(meanLat));
  const projected = vertices.map<[number, number]>(([lon, lat]) => [
    lon * METERS_PER_DEGREE_LAT * cosLat,
    lat * METERS_PER_DEGREE_LAT,
  ]);
  let sum = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
};

export const metersToMiles = (m: number): number => m * MILES_PER_METER;
export const sqMetersToAcres = (m2: number): number => m2 * ACRES_PER_SQ_METER;
