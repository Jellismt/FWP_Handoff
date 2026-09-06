/**
 * @file mapStore.ts
 * @module engage-mt/store
 * @description R.4a — Co-located map-shell state. Two related Zustand stores
 *              live here: `useMapModeStore` (persisted basemap + last
 *              viewpoint) and `useMapViewRefStore` (transient publisher for
 *              the active MapView reference).
 *
 * Rationale: both stores describe "what the
 *              user is looking at on the map" — mapMode owns the persisted
 *              answer (where, on what basemap), mapViewRef owns the transient
 *              runtime handle (which ArcGIS view object is live right now).
 *              They live on different lifecycles, but the team reads them
 *              together and wires them at the same MapView mount point.
 *
 *              Why two stores instead of one merged store: a single combined
 *              store would force every subscriber to re-render on any change.
 *              Basemap flips (rare) and view-ref changes should not
 *              invalidate viewpoint subscribers.
 *
 *              `mapModeStore.ts` + `mapViewRefStore.ts` re-export from here
 *              so existing imports continue to work — for the
 *              "opportunistic migration" policy. (The store keeps its
 *              historical name + persisted key so returning users keep their
 *              saved basemap/viewpoint.)
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-15
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type MapView from "@arcgis/core/views/MapView";

/* ── Persisted basemap + viewpoint ─────────────────────────────────── */

/**
 * Esri basemap ids exposed in the basemap picker. All three resolve via
 * `Basemap.fromId()` in MapView, so adding one here needs no map-engine
 * change. `hybrid` (imagery + place/road labels) is the high-value outdoors
 * middle ground between raw imagery and the topo vector.
 * (An FWP-custom basemap stays a future, stub-gated addition —.)
 */
export type BasemapKey = "satellite" | "hybrid" | "topo-vector";

export interface MapViewpoint {
  /** Center as [lon, lat] in WGS84. */
  center: [number, number];
  /** 2D zoom. */
  zoom: number;
}

interface MapModeState {
  basemap: BasemapKey;
  /** Last persisted viewpoint. Null on first launch. */
  viewpoint: MapViewpoint | null;
  setBasemap: (next: BasemapKey) => void;
  setViewpoint: (next: MapViewpoint) => void;
}

export const useMapModeStore = create<MapModeState>()(
  persist(
    (set) => ({
      basemap: "satellite",
      viewpoint: null,
      setBasemap: (basemap) => set({ basemap }),
      setViewpoint: (viewpoint) => set({ viewpoint }),
    }),
    {
      // Historical key kept so returning users keep their saved basemap;
      // a stale persisted `mode`/`heading`/`tilt` field is simply ignored.
      name: "engage-mt:map-mode",
      partialize: (state) => ({
        basemap: state.basemap,
        viewpoint: state.viewpoint,
      }),
    },
  ),
);

/* ── Transient view reference publisher ────────────────────────────── */

export type ActiveView = MapView | null;

interface MapViewRefState {
  view: ActiveView;
  setView: (view: ActiveView) => void;
}

export const useMapViewRefStore = create<MapViewRefState>((set) => ({
  view: null,
  setView: (view) => set({ view }),
}));
