/**
 * @file nwisRdb.test.mjs
 * @module engage-mt/build-data
 * @description RDB parsing, river-name expansion, and stream-only catalog rows.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRdb, riverFromStationName, toGageRows } from "./nwisRdb.mjs";

const RDB = [
  "# comment",
  "# another",
  "agency_cd\tsite_no\tstation_nm\tsite_tp_cd\tdec_lat_va\tdec_long_va",
  "5s\t15s\t50s\t7s\t16s\t16s",
  "USGS\t06192500\tYellowstone R near Livingston MT\tST\t45.66300\t-110.55630",
  "USGS\t06191500\tYellowstone R at Corwin Springs MT\tST\t45.11290\t-110.79640",
  "USGS\t12301300\tLake Koocanusa at Libby Dam MT\tLK\t48.40000\t-115.31000",
].join("\n");

test("parseRdb skips comments and the format line", () => {
  const rows = parseRdb(RDB);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].site_no, "06192500");
  assert.equal(rows[0].dec_lat_va, "45.66300");
  assert.deepEqual(parseRdb("# only\n"), []);
});

test("riverFromStationName drops the locator and expands abbreviations", () => {
  assert.equal(riverFromStationName("Yellowstone R at Corwin Springs MT"), "Yellowstone River");
  assert.equal(riverFromStationName("N Fk Flathead R nr Columbia Falls MT"), "North Fork Flathead River");
  assert.equal(riverFromStationName("Rock Cr bl Horse Cr nr Intl Boundary"), "Rock Creek");
  assert.equal(riverFromStationName("Clark Fork ab Missoula MT"), "Clark Fork");
});

test("toGageRows keeps streams only, rounds coordinates, and sorts by site number", () => {
  const rows = toGageRows(parseRdb(RDB));
  assert.deepEqual(
    rows.map((r) => r.site_no),
    ["06191500", "06192500"],
  );
  assert.deepEqual(rows[0], {
    site_no: "06191500",
    name: "Yellowstone R at Corwin Springs MT",
    river: "Yellowstone River",
    lat: 45.1129,
    lon: -110.7964,
    type: "stream",
  });
});
