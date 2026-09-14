/**
 * @file store.ts
 * @module engage-mt/staff
 * @description Minimal Zustand store: the signed-in identity, the active season year
 *              (every screen is scoped to it), and the loaded season-year list that
 *              backs the topbar switcher + the year-lifecycle actions.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-04
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import { api, type StaffMe, type SeasonYearRow } from "./api.js";

interface AppState {
  me: StaffMe | null;
  seasonYear: number;
  seasonYears: SeasonYearRow[];
  setMe: (me: StaffMe | null) => void;
  setSeasonYear: (year: number) => void;
  /** Load the season-year list from the API; clamp the active year to one that exists. */
  refreshSeasonYears: () => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  me: null,
  seasonYear: 2026,
  seasonYears: [],
  setMe: (me) => set({ me }),
  setSeasonYear: (seasonYear) => set({ seasonYear }),
  refreshSeasonYears: async () => {
    const rows = await api.seasonYears();
    set({ seasonYears: rows });
    // Keep the active year valid: if it vanished (or on first load it isn't present),
    // fall back to the most recent year the API returned.
    if (rows.length > 0 && !rows.some((y) => y.season_year === get().seasonYear)) {
      set({ seasonYear: Math.max(...rows.map((y) => y.season_year)) });
    }
  },
}));
