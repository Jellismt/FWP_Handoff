/**
 * @file useRegsIndex.regsPdfPath.test.ts
 * @module engage-mt/services/regs
 * @description Guards the regs-document link seam. The regulation
 *              documents are not bundled (source links point at FWP's
 *              canonical online page), `regsPdfPath` is a platform-blind
 *              passthrough and `FWP_REGS_URL` is the canonical target.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-21
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { regsPdfPath, FWP_REGS_URL } from "./useRegsIndex";

describe("regsPdfPath", () => {
  it("passes absolute URLs through unchanged", () => {
    const abs = "https://fwp.mt.gov/hunt/regulations";
    expect(regsPdfPath(abs)).toBe(abs);
  });

  it("returns a relative path unchanged (no platform rewrite)", () => {
    expect(regsPdfPath("/regs/regs-index.json")).toBe("/regs/regs-index.json");
  });
});

describe("FWP_REGS_URL", () => {
  it("is the canonical FWP hunting-regulations page", () => {
    expect(FWP_REGS_URL).toBe("https://fwp.mt.gov/hunt/regulations");
  });
});
