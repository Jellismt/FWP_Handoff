/**
 * @file nwisRdb.mjs
 * @module engage-mt/build-data
 * @description Parses the USGS NWIS Site Service RDB (tab-separated) format
 *              and shapes active Montana stream gages into the catalog rows
 *              the app bundles: site number, station name, a readable river
 *              name, and coordinates.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** RDB: `#` comment lines, one header line, one column-format line, then tab-separated rows. */
export function parseRdb(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length < 2) return [];
  const columns = lines[0].split("\t");
  return lines.slice(2).map((line) => {
    const cells = line.split("\t");
    const row = {};
    columns.forEach((c, i) => {
      row[c] = cells[i] ?? "";
    });
    return row;
  });
}

const WORDS = {
  R: "River",
  RV: "River",
  RIV: "River",
  CR: "Creek",
  CK: "Creek",
  FK: "Fork",
  N: "North",
  S: "South",
  E: "East",
  W: "West",
  NF: "North Fork",
  SF: "South Fork",
  EF: "East Fork",
  WF: "West Fork",
  MF: "Middle Fork",
  L: "Little",
  BR: "Branch",
  TRIB: "Tributary",
  MTN: "Mountain",
  STA: "Station",
  ST: "St.",
};

const LOCATOR = /\s+(?:AT|NR|NEAR|BL|BLW|BELOW|AB|ABV|ABOVE|A|NR\.|@)\s+.*$/i;

/** "Yellowstone R at Corwin Springs MT" → "Yellowstone River". */
export function riverFromStationName(name) {
  const base = String(name ?? "")
    .replace(/,?\s+MT\s*$/i, "")
    .replace(LOCATOR, "")
    .trim();
  return base
    .split(/\s+/)
    .map((w) => WORDS[w.toUpperCase()] ?? w)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Site rows → catalog rows, streams only, sorted by site number. */
export function toGageRows(sites) {
  return sites
    .filter((s) => s.site_tp_cd === "ST" && s.site_no && s.dec_lat_va && s.dec_long_va)
    .map((s) => ({
      site_no: s.site_no,
      name: s.station_nm.replace(/\s+/g, " ").trim(),
      river: riverFromStationName(s.station_nm),
      lat: Math.round(Number(s.dec_lat_va) * 1e4) / 1e4,
      lon: Math.round(Number(s.dec_long_va) * 1e4) / 1e4,
      type: "stream",
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon))
    .sort((a, b) => a.site_no.localeCompare(b.site_no));
}
