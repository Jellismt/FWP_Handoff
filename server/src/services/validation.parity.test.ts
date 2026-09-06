/**
 * @file validation.parity.test.ts
 * @module engage-mt/server/services
 * @description Behavioral test for the spatial-parity validation checks: given seeded
 *              rows (mocked DB), the right findings fire with the right severity; given
 *              a healthy season, none do. Guards the "is 2026 keyed to districts?" audit.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB so validateSeasonYear runs against seeded rows, no Postgres needed.
vi.mock("../db/pool.js", () => ({ query: vi.fn() }));
import { query } from "../db/pool.js";
import { validateSeasonYear } from "./validation.js";

const mockQuery = vi.mocked(query);

/** Route each check's SQL to a canned result by a distinctive substring. */
function route(rowsBySubstring: Record<string, unknown[]>) {
  mockQuery.mockImplementation((sql?: string) => {
    const text = typeof sql === "string" ? sql : "";
    for (const [needle, rows] of Object.entries(rowsBySubstring))
      if (text.includes(needle)) return Promise.resolve({ rows } as never);
    return Promise.resolve({ rows: [] } as never);
  });
}

beforeEach(() => mockQuery.mockReset());

describe("validateSeasonYear — spatial parity", () => {
  it("flags a hunt area with opportunities but no members as a blocking error", async () => {
    route({ "AS opp_count": [{ area_code: "MULTI-R4", opp_count: "3" }] });
    const f = await validateSeasonYear(2026);
    const hit = f.find((x) => x.code === "HUNT_AREA_NO_MEMBERS");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("error");
    expect(hit!.anchor).toBe("huntarea:MULTI-R4");
    expect(hit!.message).toContain("no member districts");
  });

  it("warns on a MULTI area with fewer than two members", async () => {
    route({ "AS member_count": [{ area_code: "MULTI-380-391", member_count: "1" }] });
    const f = await validateSeasonYear(2026);
    const hit = f.find((x) => x.code === "MULTI_AREA_SINGLE_MEMBER");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("warning");
    expect(hit!.anchor).toBe("huntarea:MULTI-380-391");
  });

  it("warns on a restricted area linked to no district", async () => {
    route({ "regs.restricted_area ra": [{ area_name: "Libby CWD Zone" }] });
    const f = await validateSeasonYear(2026);
    const hit = f.find((x) => x.code === "RESTRICTED_AREA_NO_DISTRICTS");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("warning");
    expect(hit!.message).toContain("Libby CWD Zone");
  });

  it("warns on a portion-text opportunity not linked to a portion (curation backlog)", async () => {
    route({ "portion|that part": [{ district_code: "314", species_code: "elk", n: "2" }] });
    const f = await validateSeasonYear(2026);
    const hit = f.find((x) => x.code === "PORTION_TEXT_UNLINKED");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("warning");
    expect(hit!.anchor).toBe("district:314");
    expect(hit!.message).toContain("not linked to a portion");
  });

  it("stays silent on a fully-keyed season (all checks empty)", async () => {
    route({});
    const f = await validateSeasonYear(2026);
    const parity = ["HUNT_AREA_NO_MEMBERS", "MULTI_AREA_SINGLE_MEMBER", "RESTRICTED_AREA_NO_DISTRICTS", "PORTION_TEXT_UNLINKED"];
    expect(f.filter((x) => parity.includes(x.code))).toHaveLength(0);
  });
});
