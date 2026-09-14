/**
 * @file tipMontStore.ts
 * @module engage-mt/store
 * @description Tier-3 store for the TipMont dialog (warden-contacts
 *              directory). `openTipMont()` flips it open and the single
 *              <TipMontPortal/> mounted in App.tsx takes over. No
 *              coordinates, no analytics — the dialog only lists public
 *              FWP contact information.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import { rememberFocusTrigger } from "@/utils/focusReturn";

interface TipMontState {
  open: boolean;
  close: () => void;
}

export const useTipMontStore = create<TipMontState>((set) => ({
  open: false,
  close: () => set({ open: false }),
}));

/** Imperative opener for non-React callers + event handlers. */
export const openTipMont = (): void => {
  // Snapshot the trigger (e.g. the header pill) BEFORE Calcite moves focus into
  // the dialog, so focus can return there on close (see TipMontPortal).
  rememberFocusTrigger();
  useTipMontStore.setState({ open: true });
};
