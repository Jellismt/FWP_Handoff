/**
 * @file staffCrudRoutes.members.test.ts
 * @module engage-mt/server/routes
 * @description Source-level pin (like the leak-guard): GET /hunt-areas/:id/members must
 *              exist and return BOTH district and portion members, so the staff editor can
 *              pre-check served districts and preserve portions on the full-replace save.
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
const src = readFileSync(join(here, "staffCrudRoutes.ts"), "utf8");

describe("hunt-area member-read endpoint", () => {
  it("exposes GET /hunt-areas/:id/members", () => {
    expect(src).toContain('app.get("/hunt-areas/:id/members"');
  });

  it("returns district AND portion members (so the editor preserves portions)", () => {
    const block = src.slice(src.indexOf('app.get("/hunt-areas/:id/members"'));
    expect(block).toContain("ham.district_id");
    expect(block).toContain("d.district_code");
    expect(block).toContain("ham.portion_id");
    expect(block).toContain("p.portion_name");
    expect(block).toContain("regs.hunt_area_member");
  });
});
