/**
 * @file highlightedFeatureStore.test.ts
 * @module engage-mt/store
 * @description Coverage for the search/select halo store.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @version 1.0.0
 * @updated 2026-07-03
 */

import { beforeEach, describe, expect, it } from "vitest";
import { useHighlightedFeatureStore } from "@/store/map/highlightedFeatureStore";

describe("highlightedFeatureStore", () => {
  beforeEach(() => {
    useHighlightedFeatureStore.setState({ selected: null });
  });

  it("starts null", () => {
    expect(useHighlightedFeatureStore.getState().selected).toBeNull();
  });

  it("set populates selected with expiresAt in the future", () => {
    const before = Date.now();
    useHighlightedFeatureStore.getState().set({
      lat: 46.0,
      lon: -113.0,
      label: "Bitterroot River",
      kind: "waterbody",
    });
    const s = useHighlightedFeatureStore.getState().selected;
    expect(s).not.toBeNull();
    expect(s?.label).toBe("Bitterroot River");
    expect(s?.kind).toBe("waterbody");
    expect(s?.expiresAt).toBeGreaterThan(before);
  });

  it("clear resets selected to null", () => {
    useHighlightedFeatureStore.getState().set({
      lat: 46.0,
      lon: -113.0,
      label: "X",
      kind: "point",
    });
    useHighlightedFeatureStore.getState().clear();
    expect(useHighlightedFeatureStore.getState().selected).toBeNull();
  });

  it("custom ttlMs is honored", () => {
    useHighlightedFeatureStore.getState().set({
      lat: 0,
      lon: 0,
      label: "x",
      kind: "point",
      ttlMs: 1_000,
    });
    const s = useHighlightedFeatureStore.getState().selected;
    expect(s?.expiresAt).toBeGreaterThan(Date.now());
    expect(s?.expiresAt).toBeLessThan(Date.now() + 1_500);
  });
});
