/**
 * @file offlineCoverageStore.test.ts
 * @module engage-mt/store/map
 * @description Coverage flips with the map centre and resets when cleared.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { useOfflineCoverageStore } from "./offlineCoverageStore";

const KEY = "engage-mt:offline-areas";

describe("offlineCoverageStore", () => {
  beforeEach(() => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify([
        {
          id: "camp",
          label: "Elk camp",
          bbox: { north: 46, south: 45, east: -111, west: -112 },
          minZoom: 6,
          maxZoom: 14,
          status: "downloaded",
        },
      ]),
    );
    useOfflineCoverageStore.getState().update(null);
  });

  it("starts unknown, then reports inside or nearest", () => {
    expect(useOfflineCoverageStore.getState().inCoverage).toBeNull();
    useOfflineCoverageStore.getState().update({ lon: -111.5, lat: 45.5 });
    expect(useOfflineCoverageStore.getState().inCoverage).toBe(true);
    useOfflineCoverageStore.getState().update({ lon: -105, lat: 47 });
    const s = useOfflineCoverageStore.getState();
    expect(s.inCoverage).toBe(false);
    expect(s.nearest?.id).toBe("camp");
  });

  it("clears on null", () => {
    useOfflineCoverageStore.getState().update({ lon: -105, lat: 47 });
    useOfflineCoverageStore.getState().update(null);
    expect(useOfflineCoverageStore.getState().nearest).toBeNull();
  });
});
