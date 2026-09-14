/**
 * @file mapViewRefStore.test.ts
 * @module engage-mt/store
 * @description R.2a — Characterization test gating the R.4a merge with mapModeStore.
 *              Verifies initial state, setView round-trip, and clear-back-to-null.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useMapViewRefStore, type ActiveView } from "@/store/map/mapViewRefStore";

describe("mapViewRefStore", () => {
  beforeEach(() => {
    useMapViewRefStore.setState({ view: null });
  });

  it("starts with view === null", () => {
    expect(useMapViewRefStore.getState().view).toBeNull();
  });

  it("setView publishes the view ref", () => {
    const fakeView = { destroyed: false } as unknown as NonNullable<ActiveView>;
    useMapViewRefStore.getState().setView(fakeView);
    expect(useMapViewRefStore.getState().view).toBe(fakeView);
  });

  it("setView(null) clears the publisher", () => {
    const fakeView = { destroyed: false } as unknown as NonNullable<ActiveView>;
    useMapViewRefStore.getState().setView(fakeView);
    useMapViewRefStore.getState().setView(null);
    expect(useMapViewRefStore.getState().view).toBeNull();
  });
});
