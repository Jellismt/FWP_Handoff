/**
 * @file attachAoiRectangle.test.ts
 * @module engage-mt/map
 * @description Unit tests for the two-corner AOI rectangle draw session. The
 *              @arcgis/core Graphic / GraphicsLayer / Polygon / Point classes are
 *              mocked as recording shells; the pure aoiGeometry helpers run for
 *              real. A fake MapView captures the click + pointer-move handlers so
 *              the test drives the interaction: first corner (dot + no complete),
 *              rubber-band preview on move, second corner (onComplete with the
 *              normalized bbox), the degenerate same-point double-tap reject, the
 *              null-coordinate guards, and detach cleanup.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-02
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AoiBbox } from "@/services/map/aoiGeometry";

const created = vi.hoisted(() => ({
  graphics: [] as Array<{ geometry: unknown; symbol: { type: string } }>,
  points: [] as Array<{ longitude: number; latitude: number }>,
  polygons: [] as Array<{ rings: number[][][] }>,
}));

vi.mock("@arcgis/core/Graphic", () => ({
  default: class {
    geometry: unknown;
    symbol: unknown;
    constructor(props: { geometry: unknown; symbol: { type: string } }) {
      this.geometry = props.geometry;
      this.symbol = props.symbol;
      created.graphics.push(props);
    }
  },
}));

vi.mock("@arcgis/core/layers/GraphicsLayer", () => ({
  default: class {
    id: string;
    add = vi.fn();
    removeAll = vi.fn();
    constructor(props: { id: string }) {
      this.id = props.id;
    }
  },
}));

vi.mock("@arcgis/core/geometry/Polygon", () => ({
  default: class {
    rings: number[][][];
    constructor(props: { rings: number[][][] }) {
      this.rings = props.rings;
      created.polygons.push(props);
    }
  },
}));

vi.mock("@arcgis/core/geometry/Point", () => ({
  default: class {
    longitude: number;
    latitude: number;
    constructor(props: { longitude: number; latitude: number }) {
      this.longitude = props.longitude;
      this.latitude = props.latitude;
      created.points.push(props);
    }
  },
}));

import { attachAoiRectangle } from "./attachAoiRectangle";

type ClickHandler = (e: {
  stopPropagation: () => void;
  mapPoint: { longitude: number | null; latitude: number | null };
}) => void;
type MoveHandler = (e: { x: number; y: number }) => void;

interface FakeView {
  handlers: { click?: ClickHandler; "pointer-move"?: MoveHandler };
  removeCalls: { click: number; move: number };
  toMapResult: { longitude: number | null; latitude: number | null } | null;
  map: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
}

const makeView = (): FakeView => {
  const view: FakeView = {
    handlers: {},
    removeCalls: { click: 0, move: 0 },
    toMapResult: { longitude: -111, latitude: 46 },
    map: { add: vi.fn(), remove: vi.fn() },
  };
  return view;
};

// The view carries the ArcGIS EventHandler `.on()` contract; we record handlers.
const withOn = (view: FakeView) =>
  ({
    map: view.map,
    on: (type: string, handler: ClickHandler | MoveHandler) => {
      if (type === "click") {
        view.handlers.click = handler as ClickHandler;
        return { remove: () => (view.removeCalls.click += 1) };
      }
      view.handlers["pointer-move"] = handler as MoveHandler;
      return { remove: () => (view.removeCalls.move += 1) };
    },
    toMap: () => view.toMapResult,
  }) as never;

const click = (view: FakeView, lon: number | null, lat: number | null): void => {
  view.handlers.click?.({
    stopPropagation: vi.fn(),
    mapPoint: { longitude: lon, latitude: lat },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  created.graphics.length = 0;
  created.points.length = 0;
  created.polygons.length = 0;
});

describe("attachAoiRectangle", () => {
  it("adds a hidden AOI graphics layer to the map on attach", () => {
    const view = makeView();
    attachAoiRectangle(withOn(view), { onComplete: vi.fn() });
    expect(view.map.add).toHaveBeenCalledTimes(1);
  });

  it("drops a corner dot on the first click without completing", () => {
    const view = makeView();
    const onComplete = vi.fn();
    attachAoiRectangle(withOn(view), { onComplete });
    click(view, -111.5, 46.5);
    expect(created.points).toHaveLength(1);
    expect(created.points[0]).toEqual({ longitude: -111.5, latitude: 46.5 });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("draws a rubber-band preview rectangle on pointer-move after the first corner", () => {
    const view = makeView();
    attachAoiRectangle(withOn(view), { onComplete: vi.fn() });
    click(view, -111.5, 46.5);
    view.toMapResult = { longitude: -111.0, latitude: 46.0 };
    view.handlers["pointer-move"]?.({ x: 10, y: 20 });
    expect(created.polygons.length).toBeGreaterThan(0);
    // Ring is a closed 5-vertex box.
    expect(created.polygons.at(-1)!.rings[0]).toHaveLength(5);
  });

  it("does not draw a preview before the first corner is set", () => {
    const view = makeView();
    attachAoiRectangle(withOn(view), { onComplete: vi.fn() });
    view.handlers["pointer-move"]?.({ x: 10, y: 20 });
    expect(created.polygons).toHaveLength(0);
  });

  it("completes with a normalized bbox on the second click, regardless of draw order", () => {
    const view = makeView();
    const onComplete = vi.fn<(b: AoiBbox) => void>();
    attachAoiRectangle(withOn(view), { onComplete });
    // Draw SE corner first, then NW — the bbox must still be normalized.
    click(view, -111.0, 46.0);
    click(view, -111.5, 46.5);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toEqual({
      north: 46.5,
      south: 46.0,
      east: -111.0,
      west: -111.5,
    });
  });

  it("rejects a degenerate same-point double tap without completing", () => {
    const view = makeView();
    const onComplete = vi.fn();
    attachAoiRectangle(withOn(view), { onComplete });
    click(view, -111.5, 46.5);
    click(view, -111.5, 46.5);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("ignores clicks with null map coordinates", () => {
    const view = makeView();
    const onComplete = vi.fn();
    attachAoiRectangle(withOn(view), { onComplete });
    click(view, null, 46.5);
    expect(created.points).toHaveLength(0);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("ignores a pointer-move when toMap yields null coordinates", () => {
    const view = makeView();
    attachAoiRectangle(withOn(view), { onComplete: vi.fn() });
    click(view, -111.5, 46.5);
    view.toMapResult = { longitude: null, latitude: null };
    view.handlers["pointer-move"]?.({ x: 5, y: 5 });
    expect(created.polygons).toHaveLength(0);
  });

  it("removes both handlers and the layer on detach", () => {
    const view = makeView();
    const detach = attachAoiRectangle(withOn(view), { onComplete: vi.fn() });
    detach();
    expect(view.removeCalls.click).toBe(1);
    expect(view.removeCalls.move).toBe(1);
    expect(view.map.remove).toHaveBeenCalledTimes(1);
  });
});
