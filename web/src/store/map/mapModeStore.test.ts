/**
 * @file mapModeStore.test.ts
 * @module engage-mt/store
 * @description Direct tests for the persisted viewpoint
 *              slice. Verifies setBasemap / setViewpoint mutate the store
 *              correctly, and that the viewpoint round-trips through the
 *              `persist` middleware key `engage-mt:map-mode`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-07-15
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useMapModeStore } from "@/store/map/mapModeStore";

describe("mapModeStore", () => {
  beforeEach(() => {
    useMapModeStore.setState({ basemap: "satellite", viewpoint: null });
    window.localStorage.clear();
  });

  it("starts on satellite with no viewpoint", () => {
    const s = useMapModeStore.getState();
    expect(s.basemap).toBe("satellite");
    expect(s.viewpoint).toBeNull();
  });

  it("setBasemap updates the active basemap", () => {
    useMapModeStore.getState().setBasemap("topo-vector");
    expect(useMapModeStore.getState().basemap).toBe("topo-vector");
  });

  it("setViewpoint persists the viewpoint into localStorage under the persist key", () => {
    useMapModeStore.getState().setViewpoint({
      center: [-111.5, 46.5],
      zoom: 11,
    });
    const vp = useMapModeStore.getState().viewpoint;
    expect(vp?.center).toEqual([-111.5, 46.5]);
    expect(vp?.zoom).toBe(11);

    // The persist middleware writes through synchronously on set.
    const raw = window.localStorage.getItem("engage-mt:map-mode");
    expect(raw).toBeTruthy();
    if (raw) {
      const parsed = JSON.parse(raw);
      expect(parsed.state.viewpoint.center).toEqual([-111.5, 46.5]);
      expect(parsed.state.viewpoint.zoom).toBe(11);
    }
  });

  it("viewpoint round-trip: write then re-read state.viewpoint", () => {
    const before = { center: [-110.0, 47.0] as [number, number], zoom: 9 };
    useMapModeStore.getState().setViewpoint(before);
    const after = useMapModeStore.getState().viewpoint;
    expect(after).toEqual(before);
  });
});
