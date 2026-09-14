/**
 * @file tapQueryFailureStore.test.ts
 * @module engage-mt/store
 * @description Unit tests for the primitive that
 *              tracks transient per-tap layer-query failures.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  useTapQueryFailureStore,
  selectFailureList,
  type TapQueryFailure,
} from "@/store/map/tapQueryFailureStore";

const mkFailure = (
  id: string,
  at: string,
  reason: TapQueryFailure["reason"] = "unknown",
): TapQueryFailure => ({
  layerId: id,
  layerTitle: id.toUpperCase(),
  reason,
  at,
});

describe("tapQueryFailureStore", () => {
  beforeEach(() => {
    useTapQueryFailureStore.getState().clear();
  });

  it("starts empty", () => {
    expect(Object.keys(useTapQueryFailureStore.getState().failures)).toHaveLength(0);
    expect(selectFailureList(useTapQueryFailureStore.getState())).toHaveLength(0);
  });

  it("records a failure keyed by layerId", () => {
    const f = mkFailure("fishing-access-sites", "2026-06-02T00:00:00Z", "timeout");
    useTapQueryFailureStore.getState().recordFailure(f);
    const state = useTapQueryFailureStore.getState();
    expect(state.failures["fishing-access-sites"]).toEqual(f);
  });

  it("overwrites a prior failure for the same layer (newest wins)", () => {
    useTapQueryFailureStore
      .getState()
      .recordFailure(mkFailure("bma", "2026-06-02T00:00:00Z", "timeout"));
    useTapQueryFailureStore
      .getState()
      .recordFailure(mkFailure("bma", "2026-06-02T00:00:05Z", "network"));
    const list = selectFailureList(useTapQueryFailureStore.getState());
    expect(list).toHaveLength(1);
    expect(list[0].reason).toBe("network");
    expect(list[0].at).toBe("2026-06-02T00:00:05Z");
  });

  it("clear() wipes the store", () => {
    useTapQueryFailureStore.getState().recordFailure(mkFailure("a", "2026-06-02T00:00:00Z"));
    useTapQueryFailureStore.getState().recordFailure(mkFailure("b", "2026-06-02T00:00:01Z"));
    useTapQueryFailureStore.getState().clear();
    expect(selectFailureList(useTapQueryFailureStore.getState())).toHaveLength(0);
  });

  it("selectFailureList returns entries newest-first", () => {
    useTapQueryFailureStore.getState().recordFailure(mkFailure("a", "2026-06-02T00:00:00Z"));
    useTapQueryFailureStore.getState().recordFailure(mkFailure("b", "2026-06-02T00:00:02Z"));
    useTapQueryFailureStore.getState().recordFailure(mkFailure("c", "2026-06-02T00:00:01Z"));
    const list = selectFailureList(useTapQueryFailureStore.getState());
    expect(list.map((f) => f.layerId)).toEqual(["b", "c", "a"]);
  });
});
