/**
 * @file utm.ts
 * @module engage-mt/services/spatialContext
 * @description Pure-JS lat/lon → UTM (zone, easting, northing).
 *              Closed-form WGS84 conversion; ±0.5 m at Montana latitudes,
 *              which is well below the resolution any user-facing pill
 *              needs. No external SDK; runs anywhere lat/lon is available.
 *
 *              Math is the standard Karney / USGS reduction used by
 *              proj4 and ArcGIS's geometryEngine — re-implemented here so
 *              the spatial-context block doesn't pull a 200 KB projection
 *              library just for one row.
 *
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export interface UtmCoord {
  zone: number;
  hemisphere: "N" | "S";
  easting: number;
  northing: number;
}

const A = 6378137; // WGS84 semi-major axis (m)
const F = 1 / 298.257223563; // WGS84 flattening
const K0 = 0.9996; // UTM scale factor at central meridian
const E2 = F * (2 - F); // first eccentricity squared
const E_PRIME_2 = E2 / (1 - E2);

const deg = (d: number): number => (d * Math.PI) / 180;

/** Convert WGS84 lat/lon (degrees) to a UTM zone + easting + northing. */
export function latLonToUtm(latitudeDeg: number, longitudeDeg: number): UtmCoord {
  // Zone calc — same convention as USGS: zones span 6° of longitude
  // starting at -180. Clamp to [1..60].
  let zone = Math.floor((longitudeDeg + 180) / 6) + 1;
  if (zone < 1) zone = 1;
  if (zone > 60) zone = 60;

  const lonOrigin = (zone - 1) * 6 - 180 + 3; // central meridian for the zone
  const lat = deg(latitudeDeg);
  const lon = deg(longitudeDeg);
  const lonOriginRad = deg(lonOrigin);

  const N = A / Math.sqrt(1 - E2 * Math.sin(lat) * Math.sin(lat));
  const T = Math.tan(lat) * Math.tan(lat);
  const C = E_PRIME_2 * Math.cos(lat) * Math.cos(lat);
  const Asub = Math.cos(lat) * (lon - lonOriginRad);

  const M =
    A *
    ((1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 * E2 * E2) / 256) * lat -
      ((3 * E2) / 8 + (3 * E2 * E2) / 32 + (45 * E2 * E2 * E2) / 1024) * Math.sin(2 * lat) +
      ((15 * E2 * E2) / 256 + (45 * E2 * E2 * E2) / 1024) * Math.sin(4 * lat) -
      ((35 * E2 * E2 * E2) / 3072) * Math.sin(6 * lat));

  const easting =
    K0 *
      N *
      (Asub +
        ((1 - T + C) * Asub * Asub * Asub) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * E_PRIME_2) * Asub * Asub * Asub * Asub * Asub) / 120) +
    500000.0;

  let northing =
    K0 *
    (M +
      N *
        Math.tan(lat) *
        ((Asub * Asub) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * Asub * Asub * Asub * Asub) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * E_PRIME_2) *
            Asub *
            Asub *
            Asub *
            Asub *
            Asub *
            Asub) /
            720));

  if (latitudeDeg < 0) northing += 10000000.0;

  return {
    zone,
    hemisphere: latitudeDeg >= 0 ? "N" : "S",
    easting: Math.round(easting),
    northing: Math.round(northing),
  };
}

/** Format a UtmCoord as "12N 481234 5051234". */
export function formatUtm(u: UtmCoord): string {
  return `${u.zone}${u.hemisphere} ${u.easting.toLocaleString("en-US")} ${u.northing.toLocaleString("en-US")}`;
}

/** Format a decimal degree as DMS: "45° 30' 12.3\" N". */
export function formatDms(deg: number, axis: "lat" | "lon"): string {
  const sign = deg < 0 ? -1 : 1;
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const s = (minFloat - m) * 60;
  const dir = axis === "lat" ? (sign >= 0 ? "N" : "S") : sign >= 0 ? "E" : "W";
  return `${d}° ${m}' ${s.toFixed(1)}" ${dir}`;
}
