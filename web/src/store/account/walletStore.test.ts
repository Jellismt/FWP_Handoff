/**
 * @file walletStore.test.ts
 * @module engage-mt/store
 * @description R.2a — Characterization test for the MyFWP wallet cache.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useWalletStore } from "@/store/account/walletStore";
import type { LicenseWalletResponse } from "@/services/stubs/myFwpLicenses.stub";

describe("walletStore", () => {
  beforeEach(() => useWalletStore.getState().clear());

  it("starts with wallet === null", () => {
    expect(useWalletStore.getState().wallet).toBeNull();
  });

  it("setWallet stores the wallet payload", () => {
    const fake: LicenseWalletResponse = {
      licenses: [],
      etags: [],
      permits: [],
    } as unknown as LicenseWalletResponse;
    useWalletStore.getState().setWallet(fake);
    expect(useWalletStore.getState().wallet).toBe(fake);
  });

  it("clear resets to null", () => {
    const fake = { licenses: [] } as unknown as LicenseWalletResponse;
    useWalletStore.getState().setWallet(fake);
    useWalletStore.getState().clear();
    expect(useWalletStore.getState().wallet).toBeNull();
  });
});
