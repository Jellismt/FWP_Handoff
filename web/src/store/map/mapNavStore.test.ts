/**
 * @file mapNavStore.test.ts
 * @module engage-mt/store
 * @description R.2a — Characterization test for the cross-component "fly the
 *              map to this point" channel.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useMapNavStore } from "@/store/map/mapNavStore";

describe("mapNavStore", () => {
  beforeEach(() => useMapNavStore.getState().clear());

  it("starts with no target", () => {
    expect(useMapNavStore.getState().target).toBeNull();
  });

  it("requestGoto publishes the target", () => {
    useMapNavStore.getState().requestGoto({
      lat: 46.5,
      lon: -111.5,
      zoom: 14,
      label: "Lone Pine FAS",
    });
    const t = useMapNavStore.getState().target;
    expect(t?.lat).toBe(46.5);
    expect(t?.lon).toBe(-111.5);
    expect(t?.zoom).toBe(14);
    expect(t?.label).toBe("Lone Pine FAS");
  });

  it("clear drops the target", () => {
    useMapNavStore.getState().requestGoto({ lat: 46, lon: -111 });
    useMapNavStore.getState().clear();
    expect(useMapNavStore.getState().target).toBeNull();
  });
});
