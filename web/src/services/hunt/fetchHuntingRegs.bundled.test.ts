/**
 * @file fetchHuntingRegs.bundled.test.ts
 * @module engage-mt/services/hunt
 * @description The build-time bundled snapshot is the offline source of last
 *              resort for the v1 unified regs table. Verifies it serves when
 *              there's no network + no runtime Cache-Storage snapshot (the mobile
 *              case), stamped as a versioned bundle — and that the throw only
 *              happens when the bundle is absent too.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const getBundledRegsEntry = vi.fn();
vi.mock("@/services/regs/bundledRegsSnapshot", () => ({
  getBundledRegsEntry: (k: string) => getBundledRegsEntry(k),
}));

import { fetchHuntingRegs, resetHuntingRegsCache, RegsUnavailableError } from "./fetchHuntingRegs";

beforeEach(() => {
  getBundledRegsEntry.mockReset();
  resetHuntingRegsCache();
  // Force the network leg (if a base is configured in the env) to fail so we
  // deterministically reach snapshot → bundle.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
});

afterEach(() => vi.unstubAllGlobals());

describe("fetchHuntingRegs — bundled fallback", () => {
  it("serves the bundled snapshot (versioned, not cached) with no network + no runtime snapshot", async () => {
    getBundledRegsEntry.mockResolvedValue({
      data: [{ rule_id: "r1" }, { rule_id: "r2" }],
      meta: {
        generatedAt: "2026-07-14T00:00:00.000Z",
        effectiveDate: "2026-03-01",
        validUntil: "2027-02-28",
        sourceLabel: "FWP — 2026 DEA hunting regulations (published v7)",
        version: 7,
      },
    });
    const res = await fetchHuntingRegs(true);
    expect(res.rows).toHaveLength(2);
    expect(res.freshness.tier).toBe("bundled");
    expect(res.freshness.bundled).toBe(true);
    expect(res.freshness.fromCache).toBe(false);
    expect(res.freshness.version).toBe(7);
    expect(res.freshness.effectiveDate).toBe("2026-03-01");
    expect(getBundledRegsEntry).toHaveBeenCalledWith("hunting-regulations-unified");
  });

  it("throws RegsUnavailableError when the bundle is absent too", async () => {
    getBundledRegsEntry.mockResolvedValue(null);
    await expect(fetchHuntingRegs(true)).rejects.toBeInstanceOf(RegsUnavailableError);
  });
});
