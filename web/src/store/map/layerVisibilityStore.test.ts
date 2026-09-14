/**
 * @file layerVisibilityStore.test.ts
 * @module engage-mt/store
 * @description Layer visibility store: defaults + toggle behavior.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-06
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { LAYER_REGISTRY } from "@/config/layers";
import { useLayerVisibilityStore } from "@/store/map/layerVisibilityStore";
import { isReferenceContextModule } from "@/types/layers";

describe("layerVisibilityStore", () => {
  it("seeds visibility from LAYER_REGISTRY defaultVisible", () => {
    const { visible } = useLayerVisibilityStore.getState();
    for (const layer of LAYER_REGISTRY) {
      expect(visible[layer.id]).toBe(layer.defaultVisible);
    }
  });

  it("toggle flips a layer", () => {
    const first = LAYER_REGISTRY[0];
    if (!first) return;
    const prev = useLayerVisibilityStore.getState().visible[first.id];
    useLayerVisibilityStore.getState().toggle(first.id);
    expect(useLayerVisibilityStore.getState().visible[first.id]).toBe(!prev);
    useLayerVisibilityStore.getState().toggle(first.id);
    expect(useLayerVisibilityStore.getState().visible[first.id]).toBe(prev);
  });

  it("setVisible sets explicit value", () => {
    const first = LAYER_REGISTRY[0];
    if (!first) return;
    useLayerVisibilityStore.getState().setVisible(first.id, false);
    expect(useLayerVisibilityStore.getState().visible[first.id]).toBe(false);
    useLayerVisibilityStore.getState().setVisible(first.id, true);
    expect(useLayerVisibilityStore.getState().visible[first.id]).toBe(true);
  });

  // soloLayer must turn its target on, blank other activity-module
  // layers, but PRESERVE the current visibility of reference/shared context
  // layers so a map-first tool keeps the app-open context.
  it("soloLayer turns on the target and blanks activity layers", () => {
    const activity = LAYER_REGISTRY.find(
      (l) => !isReferenceContextModule(l.module) && !l.composite,
    );
    const target = LAYER_REGISTRY.find(
      (l) => l.id !== activity?.id && !isReferenceContextModule(l.module) && !l.composite,
    );
    if (!activity || !target) return;
    const store = useLayerVisibilityStore.getState();
    store.setVisible(activity.id, true);
    store.soloLayer(target.id);
    const { visible } = useLayerVisibilityStore.getState();
    expect(visible[target.id]).toBe(true);
    expect(visible[activity.id]).toBe(false);
  });

  it("soloLayer preserves a visible reference/shared context layer", () => {
    const ref = LAYER_REGISTRY.find((l) => isReferenceContextModule(l.module) && !l.composite);
    const target = LAYER_REGISTRY.find((l) => !isReferenceContextModule(l.module) && !l.composite);
    if (!ref || !target) return;
    const store = useLayerVisibilityStore.getState();
    // Turn the context layer ON, then solo an unrelated activity layer.
    store.setVisible(ref.id, true);
    store.soloLayer(target.id);
    expect(useLayerVisibilityStore.getState().visible[ref.id]).toBe(true);
    // And a context layer the user turned OFF stays off (preserve, not force-on).
    store.setVisible(ref.id, false);
    store.soloLayer(target.id);
    expect(useLayerVisibilityStore.getState().visible[ref.id]).toBe(false);
  });
});
