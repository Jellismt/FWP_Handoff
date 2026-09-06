/**
 * @file useWallet.ts
 * @module engage-mt/hooks
 * @description Wallet read-hook. Cross-module surfaces consume this; they never call the
 *              wallet service directly.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useWalletStore } from "@/store/account/walletStore";

export const useWallet = () => {
  const wallet = useWalletStore((s) => s.wallet);
  const setWallet = useWalletStore((s) => s.setWallet);
  const clear = useWalletStore((s) => s.clear);
  return {
    isSignedIn: wallet !== null,
    wallet,
    licenses: wallet?.licenses ?? [],
    eTags: wallet?.etags ?? [],
    permits: wallet?.permits ?? [],
    setWallet,
    clear,
  };
};
