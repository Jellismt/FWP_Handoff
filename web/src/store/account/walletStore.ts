/**
 * @file walletStore.ts
 * @module engage-mt/store
 * @description Tier-3 wallet cache. Holds the user's MyFWP wallet (when signed in
 *              or when demo data is loaded). Cleared on sign-out. No server sync.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import type { LicenseWalletResponse } from "@/services/stubs/myFwpLicenses.stub";

interface WalletState {
  wallet: LicenseWalletResponse | null;
  setWallet: (wallet: LicenseWalletResponse | null) => void;
  clear: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  wallet: null,
  setWallet: (wallet) => set({ wallet }),
  clear: () => set({ wallet: null }),
}));
