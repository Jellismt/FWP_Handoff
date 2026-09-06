/**
 * @file offlineCoverageStore.ts
 * @module engage-mt/store/map
 * @description Whether the map's current centre lies inside a downloaded
 *              area, and which downloaded area is nearest when it does not.
 *              Updated by the basemap sync while the device is offline; read
 *              by the offline banner.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import {
  areaCoveringPoint,
  nearestDownloadedArea,
  type OfflineAreaRef,
} from "@/services/mobile/offlineTileResolver";

interface OfflineCoverageState {
  /** null until a position has been evaluated. */
  inCoverage: boolean | null;
  nearest: OfflineAreaRef | null;
  update: (center: { lon: number; lat: number } | null) => void;
}

export const useOfflineCoverageStore = create<OfflineCoverageState>((set) => ({
  inCoverage: null,
  nearest: null,
  update: (center) => {
    if (!center) {
      set({ inCoverage: null, nearest: null });
      return;
    }
    const covering = areaCoveringPoint(center.lon, center.lat);
    set({
      inCoverage: covering !== null,
      nearest: covering ?? nearestDownloadedArea(center.lon, center.lat),
    });
  },
}));
