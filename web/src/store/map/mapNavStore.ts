/**
 * @file mapNavStore.ts
 * @module engage-mt/store
 * @description Tier-3 cross-component channel for "fly the map to this point."
 *              Detail surfaces (FAS, BMA, state parks, …) push a target; MapView
 *              subscribes and calls view.goTo, then clears. Local-only; never persisted.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";

export interface MapNavTarget {
  /** Latitude in WGS84 degrees. */
  lat: number;
  /** Longitude in WGS84 degrees. */
  lon: number;
  /** Target zoom level. Defaults to 13 (good for a named feature). */
  zoom?: number;
  /** Optional human-readable label for accessibility (e.g. "Lone Pine FAS"). */
  label?: string;
}

interface MapNavState {
  target: MapNavTarget | null;
  requestGoto: (target: MapNavTarget) => void;
  clear: () => void;
}

export const useMapNavStore = create<MapNavState>((set) => ({
  target: null,
  requestGoto: (target) => set({ target }),
  clear: () => set({ target: null }),
}));
