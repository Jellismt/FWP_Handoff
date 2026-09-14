/**
 * @file tappedPortionStore.ts
 * @module engage-mt/store
 * @description Bridges a map tap-inside-a-portion to the district regulations panel.
 *              The URL district-detail route (`/hunt/district/:district`) carries no
 *              tap point, so when a hunter taps inside a portion the HuntingDistrictCard
 *              stashes the resolved SHAPECODE(s) + parent district here; the panel reads
 *              it and EMPHASIZES (never hides) the rules scoped to that portion. Scoped
 *              to a district so stale emphasis never bleeds onto a different one.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";

export interface TappedPortion {
  /** Parent district code the tap resolved in, e.g. "314". */
  district: string;
  /** SHAPECODEs of the portion(s) the tap fell inside — match regulation portion_code. */
  shapecodes: string[];
  /** Human names, for the "where you tapped" affordance. */
  portionNames: string[];
}

interface TappedPortionState {
  tapped: TappedPortion | null;
  set: (input: TappedPortion) => void;
  clear: () => void;
}

export const useTappedPortionStore = create<TappedPortionState>((set) => ({
  tapped: null,
  set: (input) => set({ tapped: input }),
  clear: () => set({ tapped: null }),
}));
