/**
 * @file useMapBasemapSync.test.tsx
 * @module engage-mt/map
 * @description Offline swap to the downloaded tile layer, restore when back
 *              online, and coverage tracking as the view settles.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useConnectivityStore } from "@/store/app/connectivityStore";
import { useMapModeStore } from "@/store/map/mapModeStore";
import { useOfflineCoverageStore } from "@/store/map/offlineCoverageStore";

const h = vi.hoisted(() => ({ settled: [] as Array<(stationary: boolean) => void> }));
vi.mock("@/utils/capacitor", () => ({ isCapacitor: () => true }));
vi.mock("@arcgis/core/Basemap", () => ({
  default: class {
    constructor(public props: { id?: string }) {}
    static fromId(id: string) {
      return { props: { id } };
    }
  },
}));
vi.mock("@arcgis/core/core/reactiveUtils", () => ({
  watch: (_get: () => unknown, cb: (stationary: boolean) => void) => {
    h.settled.push(cb);
    return { remove: vi.fn() };
  },
}));
vi.mock("./OfflineXyzLayer", () => ({ createOfflineXyzLayer: async () => ({ offline: true }) }));

import { useMapBasemapSync } from "./useMapBasemapSync";

const makeView = () => ({
  map: { basemap: { props: { id: "initial" } } as { props: { id?: string } } },
  stationary: true,
  center: { longitude: -111.5, latitude: 45.5 },
});

describe("useMapBasemapSync (device)", () => {
  beforeEach(() => {
    h.settled.length = 0;
    window.localStorage.setItem(
      "engage-mt:offline-areas",
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
    useConnectivityStore.getState().setOnline(true);
    useOfflineCoverageStore.getState().update(null);
  });

  it("swaps to the offline layer, tracks coverage, and restores when back online", async () => {
    const view = makeView();
    const viewRef = { current: view as never };
    renderHook(() => useMapBasemapSync(viewRef));

    act(() => useConnectivityStore.getState().setOnline(false));
    await waitFor(() => expect(view.map.basemap.props.id).toBe("offline-xyz"));
    expect(useOfflineCoverageStore.getState().inCoverage).toBe(true);

    view.center = { longitude: -105, latitude: 47 };
    act(() => h.settled.forEach((cb) => cb(true)));
    expect(useOfflineCoverageStore.getState().inCoverage).toBe(false);
    expect(useOfflineCoverageStore.getState().nearest?.id).toBe("camp");

    act(() => useConnectivityStore.getState().setOnline(true));
    expect(view.map.basemap.props.id).toBe(useMapModeStore.getState().basemap);
    expect(useOfflineCoverageStore.getState().inCoverage).toBeNull();
  });
});
