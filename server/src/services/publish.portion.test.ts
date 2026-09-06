/**
 * @file publish.portion.test.ts
 * @module engage-mt/server/services
 * @description Source-level tripwire: portion_code/portion_name must stay threaded through
 *              the snapshot path (publish INSERT columns + SELECT, publishedRepo SELECT,
 *              and migration 0027's views + published_regulations columns), and the
 *              back-compat rule — geography_id stays the parent district_code, rule_id is
 *              only portion-suffixed when a portion is present — must hold.
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

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, p), "utf8");
const publish = read("publish.ts");
const repo = read("../db/publishedRepo.ts");
const migration = read("../db/migrations/0027_portion_snapshot.sql");

describe("portion snapshot threading", () => {
  it("publish materializes portion columns from the view", () => {
    expect(publish).toContain("portion_code, portion_name");
  });

  it("the published read selects + can filter by portion", () => {
    expect(repo).toContain("portion_code, portion_name");
    expect(repo).toContain("portion_code = $");
  });

  it("migration 0027 replaces both views and adds the snapshot columns", () => {
    expect(migration).toContain("CREATE OR REPLACE VIEW regs.v_regs_unified AS");
    expect(migration).toContain("CREATE OR REPLACE VIEW regs.v_regs_unified_draft AS");
    expect(migration).toContain("ALTER TABLE regs.published_regulations");
    expect(migration).toContain("LEFT JOIN regs.district_portion dp");
  });

  it("keeps geography_id = parent district and only suffixes rule_id for portions", () => {
    // geography_id must remain d.district_code (whole-district queries unchanged).
    expect(migration).toContain("d.district_code                       AS geography_id");
    // rule_id gets the portion suffix ONLY when dp.portion_code is present.
    expect(migration).toContain("WHEN dp.portion_code IS NOT NULL THEN ':' || dp.portion_code ELSE ''");
  });
});
