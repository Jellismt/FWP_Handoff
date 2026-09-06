/**
 * @file layerLoadStatusStore.test.ts
 * @module engage-mt/store
 * @description R.2a — Characterization test gating the R.4b merge with
 *              layerVisibilityStore. Verifies initial state, setFailed
 *              record updates, and reset semantics.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useLayerLoadStatusStore } from "@/store/map/layerLoadStatusStore";

describe("layerLoadStatusStore", () => {
  beforeEach(() => {
    useLayerLoadStatusStore.getState().reset();
  });

  it("starts with an empty failed record", () => {
    expect(useLayerLoadStatusStore.getState().failed).toEqual({});
  });

  it("setFailed records the per-layer status", () => {
    useLayerLoadStatusStore.getState().setFailed("bma", true);
    expect(useLayerLoadStatusStore.getState().failed.bma).toBe(true);
  });

  it("setFailed(false) flips a previously-failed layer back", () => {
    useLayerLoadStatusStore.getState().setFailed("wma", true);
    useLayerLoadStatusStore.getState().setFailed("wma", false);
    expect(useLayerLoadStatusStore.getState().failed.wma).toBe(false);
  });

  it("setFailed accumulates across multiple layers", () => {
    useLayerLoadStatusStore.getState().setFailed("a", true);
    useLayerLoadStatusStore.getState().setFailed("b", true);
    expect(useLayerLoadStatusStore.getState().failed).toEqual({ a: true, b: true });
  });

  it("reset clears every entry", () => {
    useLayerLoadStatusStore.getState().setFailed("a", true);
    useLayerLoadStatusStore.getState().setFailed("b", false);
    useLayerLoadStatusStore.getState().reset();
    expect(useLayerLoadStatusStore.getState().failed).toEqual({});
  });
});
