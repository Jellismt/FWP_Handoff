/**
 * @file myFwpLicenses.stub.test.ts
 * @module engage-mt/services/stubs
 * @description Stub returns deterministic shape with the right token sentinel.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-05-29
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { fetchLicenseWalletStub } from "./myFwpLicenses.stub";

describe("STUB-001 myFwpLicenses", () => {
  it("returns user + at least one license", async () => {
    const w = await fetchLicenseWalletStub();
    expect(w.user.name).toBeTruthy();
    expect(w.licenses.length).toBeGreaterThan(0);
    expect(w.etags.length).toBeGreaterThan(0);
  });

  it("does not include any production-shaped token", async () => {
    const w = await fetchLicenseWalletStub();
    const serialized = JSON.stringify(w);
    // belt-and-suspenders: ensure no JWT-ish strings
    expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]+\./);
  });
});
