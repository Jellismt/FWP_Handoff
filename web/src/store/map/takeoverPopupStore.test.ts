/**
 * @file takeoverPopupStore.test.ts
 * @module engage-mt/store
 * @description R.2a — Characterization test gating the R.4c merge with
 *              highlightedFeatureStore. Verifies openFeature populates the
 *              full state shape and close() resets it.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useTakeoverPopupStore } from "@/store/map/takeoverPopupStore";

describe("takeoverPopupStore", () => {
  beforeEach(() => {
    useTakeoverPopupStore.getState().close();
  });

  it("starts closed", () => {
    const s = useTakeoverPopupStore.getState();
    expect(s.open).toBe(false);
    expect(s.layerId).toBeNull();
    expect(s.attrs).toBeNull();
  });

  it("openFeature populates layerId, module, attrs, tapPoint", () => {
    useTakeoverPopupStore.getState().openFeature({
      layerId: "fishing-access-sites",
      layerTitle: "FAS",
      module: "fish",
      attrs: { NAME: "Lone Pine FAS" },
      tapPoint: {
        x: -111.5,
        y: 46.5,
        latitude: 46.5,
        longitude: -111.5,
      },
    });
    const s = useTakeoverPopupStore.getState();
    expect(s.open).toBe(true);
    expect(s.layerId).toBe("fishing-access-sites");
    expect(s.layerTitle).toBe("FAS");
    expect(s.module).toBe("fish");
    expect(s.attrs).toEqual({ NAME: "Lone Pine FAS" });
    expect(s.tapPoint?.latitude).toBe(46.5);
  });

  it("openFeature without tapPoint stores null (programmatic open)", () => {
    useTakeoverPopupStore.getState().openFeature({
      layerId: "x",
      layerTitle: "X",
      module: "fish",
      attrs: {},
    });
    expect(useTakeoverPopupStore.getState().tapPoint).toBeNull();
  });

  it("close flips open=false but leaves payload mounted for the exit animation", () => {
    useTakeoverPopupStore.getState().openFeature({
      layerId: "x",
      layerTitle: "X",
      module: "fish",
      attrs: { a: 1 },
    });
    useTakeoverPopupStore.getState().close();
    const s = useTakeoverPopupStore.getState();
    // Only `open` flips; the rest persists so CalciteDialog
    // can play its exit animation against still-mounted content. The values
    // get overwritten on the next openFeature() call.
    expect(s.open).toBe(false);
    expect(s.layerId).toBe("x");
    expect(s.layerTitle).toBe("X");
    expect(s.module).toBe("fish");
    expect(s.attrs).toEqual({ a: 1 });
  });

  it("next openFeature() after close fully overwrites the persisted payload", () => {
    useTakeoverPopupStore.getState().openFeature({
      layerId: "a",
      layerTitle: "A",
      module: "fish",
      attrs: { a: 1 },
    });
    useTakeoverPopupStore.getState().close();
    useTakeoverPopupStore.getState().openFeature({
      layerId: "b",
      layerTitle: "B",
      module: "hunt",
      attrs: { b: 2 },
    });
    const s = useTakeoverPopupStore.getState();
    expect(s.open).toBe(true);
    expect(s.layerId).toBe("b");
    expect(s.module).toBe("hunt");
    expect(s.attrs).toEqual({ b: 2 });
  });
});
