/**
 * @file clone.portion.test.ts
 * @module engage-mt/server/services
 * @description Source-level tripwire: clone-forward MUST carry the season-scoped tables the
 *              year-to-year audit checked — hunt-area members including portion_id (so the
 *              portion work propagates to the next year), and restricted_area + district_rarea. A behavioral clone test lives alongside the ETL runs; this
 *              pins the SQL so a future refactor can't silently drop them again.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "clone.ts"), "utf8");

describe("clone-forward carries the season-scoped regs data", () => {
  it("copies hunt-area members INCLUDING portion_id (portions propagate year-to-year)", () => {
    expect(src).toContain("INSERT INTO regs.hunt_area_member");
    expect(src).toMatch(/m\.district_id,\s*m\.portion_id/);
  });

  it("copies restricted_area", () => {
    expect(src).toContain("INSERT INTO regs.restricted_area");
  });

  it("copies district_rarea, remapping rarea_id by the (season_year, area_name) natural key", () => {
    expect(src).toContain("INSERT INTO regs.district_rarea");
    expect(src).toMatch(/nra\.area_name\s*=\s*ora\.area_name AND nra\.season_year = \$2/);
  });
});
