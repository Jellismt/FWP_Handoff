/**
 * @file mapStore.test.ts
 * @module engage-mt/store
 * @description Unit tests for the co-located map-shell stores — persisted
 *              basemap / viewpoint (useMapModeStore) and the transient
 *              active-view publisher (useMapViewRefStore).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-15
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  useMapModeStore,
  useMapViewRefStore,
  type ActiveView,
  type BasemapKey,
  type MapViewpoint,
} from "@/store/map/mapStore";

describe("useMapModeStore", () => {
  beforeEach(() => {
    // Reset to documented defaults between tests (persist middleware would
    // otherwise carry state across cases via the polyfilled localStorage).
    useMapModeStore.setState({ basemap: "satellite", viewpoint: null });
    window.localStorage.clear();
  });

  it("starts on the satellite basemap with no viewpoint", () => {
    const s = useMapModeStore.getState();
    expect(s.basemap).toBe("satellite");
    expect(s.viewpoint).toBeNull();
  });

  it("setBasemap accepts each picker key", () => {
    for (const key of ["satellite", "hybrid", "topo-vector"] as BasemapKey[]) {
      useMapModeStore.getState().setBasemap(key);
      expect(useMapModeStore.getState().basemap).toBe(key);
    }
  });

  it("setViewpoint stores center + zoom", () => {
    const vp: MapViewpoint = { center: [-110.5, 46.9], zoom: 7 };
    useMapModeStore.getState().setViewpoint(vp);
    expect(useMapModeStore.getState().viewpoint).toEqual(vp);
  });

  it("persists basemap + viewpoint under the engage-mt:map-mode key", () => {
    useMapModeStore.getState().setBasemap("hybrid");
    const raw = window.localStorage.getItem("engage-mt:map-mode");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    // zustand persist wraps under { state, version }
    expect(parsed.state.basemap).toBe("hybrid");
  });
});

describe("useMapViewRefStore", () => {
  beforeEach(() => {
    useMapViewRefStore.setState({ view: null });
  });

  it("starts with a null view", () => {
    expect(useMapViewRefStore.getState().view).toBeNull();
  });

  it("setView publishes and clears the active view handle", () => {
    // The store only holds the reference — a bare object stands in for the
    // ArcGIS MapView here (the store never calls into it).
    const fakeView = { id: "map-view" } as unknown as ActiveView;
    useMapViewRefStore.getState().setView(fakeView);
    expect(useMapViewRefStore.getState().view).toBe(fakeView);
    useMapViewRefStore.getState().setView(null);
    expect(useMapViewRefStore.getState().view).toBeNull();
  });
});
