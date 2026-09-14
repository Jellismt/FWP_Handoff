/**
 * @file useLayerVisibilitySync.test.tsx
 * @module engage-mt/map
 * @description Unit tests for the layer opacity-fade sync hook. The layer
 *              registry + visibility store are mocked at their seams, and fake
 *              Layer objects record their `visible` / `opacity` mutations.
 *              matchMedia + requestAnimationFrame are stubbed so the test drives
 *              both branches: reduced-motion (instant flip, cancels in-flight
 *              fade) and the rAF ease-out fade (in-flight cancellation, fade-out
 *              flips visible=false + resets opacity at completion, no-op when
 *              already in the target state, and the failed-layer retry-on-show).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import type Layer from "@arcgis/core/layers/Layer";

interface RegDef {
  id: string;
  opacity?: number;
}

const h = vi.hoisted(() => ({
  registry: [] as RegDef[],
  visible: {} as Record<string, boolean>,
}));

vi.mock("@/config/layers", () => ({
  get LAYER_REGISTRY() {
    return h.registry;
  },
}));

vi.mock("@/store/map/layerVisibilityStore", () => ({
  useLayerVisibilityStore: (selector: (s: { visible: Record<string, boolean> }) => unknown) =>
    selector({ visible: h.visible }),
}));

import { useLayerVisibilitySync } from "./useLayerVisibilitySync";

interface FakeLayer {
  id: string;
  visible: boolean;
  opacity: number;
  loadStatus?: string;
  load?: () => Promise<unknown>;
}

const makeLayer = (over: Partial<FakeLayer> & { id: string }): FakeLayer => ({
  visible: false,
  opacity: 1,
  ...over,
});

const setReducedMotion = (reduce: boolean): void => {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

const renderSync = (
  layers: FakeLayer[],
): {
  fadeHandlesRef: MutableRefObject<Map<string, number>>;
} => {
  const layerIndex = new Map<string, Layer>();
  for (const l of layers) layerIndex.set(l.id, l as unknown as Layer);
  const layerObjectsRef: MutableRefObject<Map<string, Layer> | null> = { current: layerIndex };
  const fadeHandlesRef: MutableRefObject<Map<string, number>> = { current: new Map() };
  renderHook(() => useLayerVisibilitySync(layerObjectsRef, fadeHandlesRef));
  return { fadeHandlesRef };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.registry = [];
  h.visible = {};
});

describe("useLayerVisibilitySync — reduced motion", () => {
  beforeEach(() => setReducedMotion(true));

  it("flips a hidden layer to visible at its registered target opacity", () => {
    h.registry = [{ id: "bma", opacity: 0.8 }];
    h.visible = { bma: true };
    const layer = makeLayer({ id: "bma", visible: false, opacity: 0 });
    renderSync([layer]);
    expect(layer.visible).toBe(true);
    expect(layer.opacity).toBe(0.8);
  });

  it("hides a visible layer and resets its opacity for the next show", () => {
    h.registry = [{ id: "fas", opacity: 1 }];
    h.visible = { fas: false };
    const layer = makeLayer({ id: "fas", visible: true, opacity: 1 });
    renderSync([layer]);
    expect(layer.visible).toBe(false);
    // Opacity is reset to the registered target so the next show fades from it.
    expect(layer.opacity).toBe(1);
  });

  it("cancels an in-flight fade before an instant reduced-motion assignment", () => {
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
    h.registry = [{ id: "wma" }];
    h.visible = { wma: true };
    const layer = makeLayer({ id: "wma", visible: false, opacity: 0 });
    const layerIndex = new Map<string, Layer>([["wma", layer as unknown as Layer]]);
    const layerObjectsRef = { current: layerIndex };
    const fadeHandlesRef = { current: new Map<string, number>([["wma", 42]]) };
    renderHook(() => useLayerVisibilitySync(layerObjectsRef, fadeHandlesRef));
    expect(cancelSpy).toHaveBeenCalledWith(42);
    expect(fadeHandlesRef.current.has("wma")).toBe(false);
    cancelSpy.mockRestore();
  });

  it("does nothing when the layer index is not yet populated", () => {
    h.registry = [{ id: "bma" }];
    h.visible = { bma: true };
    const layerObjectsRef = { current: null };
    const fadeHandlesRef = { current: new Map<string, number>() };
    // Should not throw.
    expect(() =>
      renderHook(() => useLayerVisibilitySync(layerObjectsRef, fadeHandlesRef)),
    ).not.toThrow();
  });
});

describe("useLayerVisibilitySync — animated", () => {
  let rafCbs: FrameRequestCallback[];

  beforeEach(() => {
    setReducedMotion(false);
    rafCbs = [];
    let id = 1;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCbs.push(cb);
      return id++;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    vi.spyOn(performance, "now").mockReturnValue(0);
  });

  const flushFrame = (t: number): void => {
    const cb = rafCbs.at(-1);
    if (cb) cb(t);
  };

  it("keeps the layer visible during a fade-in and reaches target opacity at completion", () => {
    h.registry = [{ id: "bma", opacity: 1 }];
    h.visible = { bma: true };
    const layer = makeLayer({ id: "bma", visible: false, opacity: 0 });
    renderSync([layer]);
    // visible flipped true immediately so it animates in.
    expect(layer.visible).toBe(true);
    flushFrame(300); // past DURATION_MS (220) → t clamps to 1
    expect(layer.opacity).toBeCloseTo(1, 5);
  });

  it("flips visible=false and resets opacity when a fade-out completes", () => {
    h.registry = [{ id: "fas", opacity: 1 }];
    h.visible = { fas: false };
    const layer = makeLayer({ id: "fas", visible: true, opacity: 1 });
    renderSync([layer]);
    // Stays visible while animating out.
    expect(layer.visible).toBe(true);
    flushFrame(300);
    expect(layer.visible).toBe(false);
    expect(layer.opacity).toBe(1); // reset to target for next show
  });

  it("skips animation for a layer already at its shown target state", () => {
    h.registry = [{ id: "bma", opacity: 1 }];
    h.visible = { bma: true };
    const layer = makeLayer({ id: "bma", visible: true, opacity: 1 });
    renderSync([layer]);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("skips animation for a layer already hidden", () => {
    h.registry = [{ id: "bma", opacity: 1 }];
    h.visible = { bma: false };
    const layer = makeLayer({ id: "bma", visible: false, opacity: 1 });
    renderSync([layer]);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("cancels an in-flight fade handle before starting a fresh one", () => {
    h.registry = [{ id: "bma", opacity: 1 }];
    h.visible = { bma: true };
    const layer = makeLayer({ id: "bma", visible: false, opacity: 0 });
    const layerIndex = new Map<string, Layer>([["bma", layer as unknown as Layer]]);
    const layerObjectsRef = { current: layerIndex };
    const fadeHandlesRef = { current: new Map<string, number>([["bma", 99]]) };
    renderHook(() => useLayerVisibilitySync(layerObjectsRef, fadeHandlesRef));
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(99);
  });

  it("retries load() on toggle-on for a previously-failed layer", () => {
    const load = vi.fn(() => Promise.resolve());
    h.registry = [{ id: "flaky", opacity: 1 }];
    h.visible = { flaky: true };
    const layer = makeLayer({
      id: "flaky",
      visible: false,
      opacity: 0,
      loadStatus: "failed",
      load,
    });
    renderSync([layer]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
