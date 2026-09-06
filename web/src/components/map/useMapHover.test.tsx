/**
 * @file useMapHover.test.tsx
 * @module engage-mt/map
 * @description Unit tests for the mouse-only hover-halo hook. The @arcgis/core
 *              GraphicsLayer / Graphic classes + the symbology helpers are mocked
 *              at their seams; a fake MapView captures the pointer-move handler
 *              and returns a controllable hitTest. Covers the touch-device skip
 *              (no overlay), overlay attach + detach cleanup, the debounced
 *              hitTest → point-halo highlight + cursor:pointer, the geometry-type
 *              branches (polygon/polyline), the same-feature-no-redraw
 *              fingerprint guard, the clear-on-empty path, and the overlay
 *              self-filter.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-02
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const created = vi.hoisted(() => ({
  layers: [] as FakeOverlay[],
  graphics: [] as Array<{ symbol: { type: string } }>,
}));

interface FakeOverlay {
  add: ReturnType<typeof vi.fn>;
  removeAll: ReturnType<typeof vi.fn>;
}

vi.mock("@arcgis/core/layers/GraphicsLayer", () => ({
  default: class {
    listMode?: string;
    add = vi.fn();
    removeAll = vi.fn();
    constructor(props: { listMode?: string }) {
      this.listMode = props.listMode;
      created.layers.push(this as unknown as FakeOverlay);
    }
  },
}));

vi.mock("@arcgis/core/Graphic", () => ({
  default: class {
    symbol: { type: string };
    geometry: unknown;
    constructor(props: { symbol: { type: string }; geometry: unknown }) {
      this.symbol = props.symbol;
      this.geometry = props.geometry;
      created.graphics.push(props);
    }
  },
}));

vi.mock("./symbology/iconSymbols", () => ({
  hasIconForLayer: (id: string) => id === "icon-backed-layer",
}));
vi.mock("./symbology/scale", () => ({
  markerSizeAtScale: (base: number) => base,
}));

import { useMapHover } from "./useMapHover";

interface FakeView {
  scale: number;
  container: { style: { cursor: string; removeProperty: (p: string) => void } };
  map: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  hitTest: ReturnType<typeof vi.fn>;
  moveHandler?: (e: unknown) => void;
  removeCalled: boolean;
}

const makeView = (hitResults: unknown[]): FakeView => {
  const view: FakeView = {
    scale: 100000,
    container: { style: { cursor: "", removeProperty: vi.fn() } },
    map: { add: vi.fn(), remove: vi.fn() },
    hitTest: vi.fn(async () => ({ results: hitResults })),
    removeCalled: false,
  };
  return view;
};

const withOn = (view: FakeView) =>
  ({
    scale: view.scale,
    container: view.container,
    map: view.map,
    hitTest: view.hitTest,
    on: (_type: string, handler: (e: unknown) => void) => {
      view.moveHandler = handler;
      return { remove: () => (view.removeCalled = true) };
    },
  }) as never;

const graphicHit = (opts: {
  layerId: string;
  geomType: string;
  oid?: number;
  layerRef?: unknown;
}) => ({
  type: "graphic" as const,
  graphic: {
    layer: opts.layerRef ?? { id: opts.layerId },
    attributes: opts.oid == null ? undefined : { OBJECTID: opts.oid },
    geometry: { type: opts.geomType },
  },
});

const setTouch = (isTouch: boolean): void => {
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: isTouch ? 5 : 0,
    configurable: true,
  });
};

const renderHover = (view: FakeView) => renderHook(() => useMapHover(withOn(view)));

beforeEach(() => {
  vi.clearAllMocks();
  created.layers.length = 0;
  created.graphics.length = 0;
  setTouch(false);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useMapHover", () => {
  it("skips entirely on touch devices — no overlay layer added", () => {
    setTouch(true);
    const view = makeView([]);
    renderHover(view);
    expect(view.map.add).not.toHaveBeenCalled();
    expect(created.layers).toHaveLength(0);
  });

  it("adds a hidden overlay layer on a non-touch device and removes it on unmount", () => {
    const view = makeView([]);
    const { unmount } = renderHover(view);
    expect(view.map.add).toHaveBeenCalledTimes(1);
    expect(created.layers[0].add).toBeDefined();
    unmount();
    expect(view.removeCalled).toBe(true);
    expect(view.map.remove).toHaveBeenCalledTimes(1);
  });

  it("paints a point halo + cursor:pointer after the debounced hitTest resolves", async () => {
    const view = makeView([
      graphicHit({ layerId: "fishing-access-sites", geomType: "point", oid: 1 }),
    ]);
    renderHover(view);
    view.moveHandler?.({ x: 5, y: 5 });
    await vi.advanceTimersByTimeAsync(40);
    await Promise.resolve();
    expect(created.graphics.at(-1)?.symbol.type).toBe("simple-marker");
    expect(view.container.style.cursor).toBe("pointer");
  });

  it("uses the fill halo for polygon geometries", async () => {
    const view = makeView([graphicHit({ layerId: "bma", geomType: "polygon", oid: 2 })]);
    renderHover(view);
    view.moveHandler?.({ x: 1, y: 1 });
    await vi.advanceTimersByTimeAsync(40);
    await Promise.resolve();
    expect(created.graphics.at(-1)?.symbol.type).toBe("simple-fill");
  });

  it("uses the line halo for polyline geometries", async () => {
    const view = makeView([graphicHit({ layerId: "streams", geomType: "polyline", oid: 3 })]);
    renderHover(view);
    view.moveHandler?.({ x: 1, y: 1 });
    await vi.advanceTimersByTimeAsync(40);
    await Promise.resolve();
    expect(created.graphics.at(-1)?.symbol.type).toBe("simple-line");
  });

  it("does not redraw the halo while the cursor stays over the same feature", async () => {
    const view = makeView([graphicHit({ layerId: "fas", geomType: "point", oid: 7 })]);
    renderHover(view);
    const overlay = created.layers[0];

    view.moveHandler?.({ x: 5, y: 5 });
    await vi.advanceTimersByTimeAsync(40);
    await Promise.resolve();
    const firstRemoveAll = overlay.removeAll.mock.calls.length;

    view.moveHandler?.({ x: 6, y: 6 });
    await vi.advanceTimersByTimeAsync(40);
    await Promise.resolve();
    // Same fingerprint → early-return before the removeAll/add redraw.
    expect(overlay.removeAll.mock.calls.length).toBe(firstRemoveAll);
  });

  it("clears the highlight + cursor when the hitTest returns no interactive features", async () => {
    const view = makeView([]);
    renderHover(view);
    const overlay = created.layers[0];
    view.moveHandler?.({ x: 5, y: 5 });
    await vi.advanceTimersByTimeAsync(40);
    await Promise.resolve();
    expect(overlay.removeAll).toHaveBeenCalled();
    expect(view.container.style.removeProperty).toHaveBeenCalledWith("cursor");
  });

  it("filters out the overlay's own graphics so it never self-halos", async () => {
    const view = makeView([]);
    renderHover(view);
    const overlay = created.layers[0];
    // Craft a hit whose layer IS the overlay — must be filtered → clear path.
    view.hitTest.mockResolvedValue({
      results: [graphicHit({ layerId: "x", geomType: "point", oid: 9, layerRef: overlay })],
    });
    view.moveHandler?.({ x: 5, y: 5 });
    await vi.advanceTimersByTimeAsync(40);
    await Promise.resolve();
    // No new highlight graphic was added; the clear path ran instead.
    expect(created.graphics).toHaveLength(0);
    expect(overlay.removeAll).toHaveBeenCalled();
  });
});
