/**
 * @file offlineAoiDraftStore.ts
 * @module engage-mt/store
 * @description Transient hand-off store between the on-map "Download this area"
 *              rectangle tool and the OfflineAoiConfirmSheet. When the user
 *              finishes drawing an AOI box, the captured bbox lands here; the
 *              confirm sheet reads it, lets the user pick label/basemap/zoom,
 *              queues via `offlineAreasStore`, then clears it. Not persisted —
 *              a draft AOI is meaningless across reloads. Per privacy rules the
 *              bbox stays on-device.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import type { AoiBbox } from "@/services/map/aoiGeometry";

interface OfflineAoiDraftState {
  /** The captured AOI bbox awaiting confirmation, or null when none is pending. */
  bbox: AoiBbox | null;
  setBbox: (bbox: AoiBbox) => void;
  clear: () => void;
}

export const useOfflineAoiDraftStore = create<OfflineAoiDraftState>((set) => ({
  bbox: null,
  setBbox: (bbox) => set({ bbox }),
  clear: () => set({ bbox: null }),
}));
