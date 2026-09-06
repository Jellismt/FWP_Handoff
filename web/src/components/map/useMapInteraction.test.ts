/**
 * @file useMapInteraction.test.ts
 * @module engage-mt/map
 * @description Unit tests for the on-canvas draw + measure hook. The @arcgis/core
 *              geometry classes, geometryEngine, and the leaf collaborators
 *              (AOI rectangle helper) are mocked at the
 *              import seam so we assert on the click/double-click pipeline, the
 *              per-tool branch selection, geometry math handoff, and cleanup —
 *              never on real ArcGIS rendering. Every store/hook is mocked so a
 *              controllable `activeTool` drives which branch the effect takes and
 *              the recorded setter calls prove the commit path.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { MapTool } from "@/store/map/mapInteractionStore";

// ── Controllable state shared across store mocks ─────────────────────────
const state = vi.hoisted(() => ({
  activeTool: "none" as MapTool,
}));

const spies = vi.hoisted(() => ({
  clearActiveTool: vi.fn(),
  addShape: vi.fn(),
  addMeasurement: vi.fn(),
  addWaypoint: vi.fn(),
  show: vi.fn(),
  beginProfile: vi.fn(),
  setProfile: vi.fn(),
  setProfileError: vi.fn(),
  setAoiDraft: vi.fn(),
  attachAoiRectangle: vi.fn(),
  detachAoi: vi.fn(),
  geodesicLength: vi.fn(() => 3218.688), // 2 miles in meters
  geodesicArea: vi.fn(() => 40468.564224), // 10 acres in m^2
}));

// ── @arcgis/core recording shells ────────────────────────────────────────
const created = vi.hoisted(() => ({
  graphicsLayers: [] as Array<{ id: string; removeAll: () => void; add: (g: unknown) => void }>,
  graphics: [] as unknown[],
  points: [] as unknown[],
  polygons: [] as unknown[],
  polylines: [] as unknown[],
}));

vi.mock("@arcgis/core/layers/GraphicsLayer", () => ({
  default: class {
    id: string;
    removeAll = vi.fn();
    add = vi.fn((g: unknown) => created.graphics.push(g));
    constructor(props: { id: string }) {
      this.id = props.id;
      created.graphicsLayers.push(this as never);
    }
  },
}));
vi.mock("@arcgis/core/Graphic", () => ({
  default: class {
    constructor(props: unknown) {
      created.graphics.push(props);
    }
  },
}));
vi.mock("@arcgis/core/geometry/Polygon", () => ({
  default: class {
    constructor(props: unknown) {
      created.polygons.push(props);
      Object.assign(this, props);
    }
  },
}));
vi.mock("@arcgis/core/geometry/Polyline", () => ({
  default: class {
    constructor(props: unknown) {
      created.polylines.push(props);
      Object.assign(this, props);
    }
  },
}));
vi.mock("@arcgis/core/geometry/Point", () => ({
  default: class {
    constructor(props: unknown) {
      created.points.push(props);
      Object.assign(this, props);
    }
  },
}));
vi.mock("@arcgis/core/geometry/geometryEngine", () => ({
  geodesicLength: spies.geodesicLength,
  geodesicArea: spies.geodesicArea,
}));

// ── Store + hook + service seams ─────────────────────────────────────────
vi.mock("@/store/map/mapInteractionStore", () => ({
  useMapInteractionStore: (sel: (s: unknown) => unknown) =>
    sel({ activeTool: state.activeTool, clearActiveTool: spies.clearActiveTool }),
}));
vi.mock("@/store/field/fieldToolsStore", () => ({
  useFieldToolsStore: (sel: (s: unknown) => unknown) =>
    sel({
      addShape: spies.addShape,
      addMeasurement: spies.addMeasurement,
      addWaypoint: spies.addWaypoint,
    }),
}));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ show: spies.show }) }));
vi.mock("@/store/field/offlineAoiDraftStore", () => ({
  useOfflineAoiDraftStore: (sel: (s: unknown) => unknown) => sel({ setBbox: spies.setAoiDraft }),
}));
vi.mock("./attachAoiRectangle", () => ({ attachAoiRectangle: spies.attachAoiRectangle }));

import { useMapInteraction } from "./useMapInteraction";

// ── A fake ArcGIS MapView that records event handlers ────────────────────
type ClickEvent = {
  stopPropagation: () => void;
  mapPoint: { longitude: number | null; latitude: number | null } | null;
};
interface FakeView {
  on: ReturnType<typeof vi.fn>;
  map: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  handlers: {
    click: Array<(e: ClickEvent) => void>;
    "double-click": Array<(e: ClickEvent) => void>;
  };
  removeSpies: ReturnType<typeof vi.fn>[];
}

const makeView = (): FakeView => {
  const handlers: FakeView["handlers"] = { click: [], "double-click": [] };
  const removeSpies: ReturnType<typeof vi.fn>[] = [];
  return {
    handlers,
    removeSpies,
    map: { add: vi.fn(), remove: vi.fn() },
    on: vi.fn((event: "click" | "double-click", cb: (e: ClickEvent) => void) => {
      handlers[event].push(cb);
      const remove = vi.fn();
      removeSpies.push(remove);
      return { remove };
    }),
  };
};

const clickAt = (view: FakeView, lon: number | null, lat: number | null): void => {
  for (const cb of view.handlers.click)
    cb({ stopPropagation: vi.fn(), mapPoint: { longitude: lon, latitude: lat } });
};
// A click whose mapPoint itself is null (the single-tap handlers guard this via
// optional chaining; the sketch handler does not — see the reported finding).
const clickNullMapPoint = (view: FakeView): void => {
  for (const cb of view.handlers.click) cb({ stopPropagation: vi.fn(), mapPoint: null });
};
const dblClick = (view: FakeView): void => {
  for (const cb of view.handlers["double-click"]) cb({ stopPropagation: vi.fn(), mapPoint: null });
};

const setTool = (tool: MapTool): void => {
  state.activeTool = tool;
};

beforeEach(() => {
  vi.clearAllMocks();
  created.graphicsLayers.length = 0;
  created.graphics.length = 0;
  created.points.length = 0;
  created.polygons.length = 0;
  created.polylines.length = 0;
  state.activeTool = "none";
  spies.attachAoiRectangle.mockReturnValue(spies.detachAoi);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useMapInteraction — guards & lifecycle", () => {
  it("attaches no listeners when there is no view", () => {
    setTool("draw-polygon");
    renderHook(() => useMapInteraction(null));
    // No view → nothing to wire.
    expect(created.graphicsLayers.length).toBe(0);
  });

  it("attaches no listeners when the active tool is none", () => {
    const view = makeView();
    setTool("none");
    renderHook(() => useMapInteraction(view as never));
    expect(view.on).not.toHaveBeenCalled();
    expect(view.map.add).not.toHaveBeenCalled();
  });
});

describe("useMapInteraction — measure-distance", () => {
  it("commits a distance measurement in miles on double-click and clears the tool", () => {
    const view = makeView();
    setTool("measure-distance");
    renderHook(() => useMapInteraction(view as never));

    clickAt(view, -111.5, 46.5);
    clickAt(view, -111.4, 46.6);
    dblClick(view);

    // geodesicLength now also runs during the live-label preview, so
    // the count is incidental; what matters is the committed value.
    expect(spies.geodesicLength).toHaveBeenCalled();
    // 3218.688 m / 1609.344 = 2 miles.
    expect(spies.addMeasurement).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "distance", value: 2 }),
    );
    expect(spies.show).toHaveBeenCalledWith(expect.objectContaining({ kind: "success" }));
    expect(spies.clearActiveTool).toHaveBeenCalledTimes(1);
  });

  it("does not commit with fewer than two vertices", () => {
    const view = makeView();
    setTool("measure-distance");
    renderHook(() => useMapInteraction(view as never));
    clickAt(view, -111.5, 46.5);
    dblClick(view);
    expect(spies.addMeasurement).not.toHaveBeenCalled();
    // Even a no-op finish clears the tool + drops the sketch layer.
    expect(spies.clearActiveTool).toHaveBeenCalledTimes(1);
  });

  it("skips sketch clicks whose mapPoint coordinates are null (out of SR)", () => {
    const view = makeView();
    setTool("measure-distance");
    renderHook(() => useMapInteraction(view as never));
    clickAt(view, null, null);
    clickAt(view, -111.5, null);
    dblClick(view);
    expect(spies.addMeasurement).not.toHaveBeenCalled();
  });
});

describe("useMapInteraction — measure-area", () => {
  it("commits an area measurement in acres for a 3+ vertex polygon", () => {
    const view = makeView();
    setTool("measure-area");
    renderHook(() => useMapInteraction(view as never));
    clickAt(view, -111.5, 46.5);
    clickAt(view, -111.4, 46.5);
    clickAt(view, -111.4, 46.6);
    dblClick(view);
    expect(spies.geodesicArea).toHaveBeenCalled();
    // 40468.564224 / 4046.8564224 = 10 acres.
    expect(spies.addMeasurement).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "area", value: 10 }),
    );
  });
});

describe("useMapInteraction — draw tools", () => {
  it("saves a polygon shape with the collected vertices", () => {
    const view = makeView();
    setTool("draw-polygon");
    renderHook(() => useMapInteraction(view as never));
    clickAt(view, -111.5, 46.5);
    clickAt(view, -111.4, 46.5);
    clickAt(view, -111.4, 46.6);
    dblClick(view);
    expect(spies.addShape).toHaveBeenCalledWith(
      expect.objectContaining({ shape: "polygon", color: "red" }),
    );
  });

  it("saves a polyline shape with two vertices", () => {
    const view = makeView();
    setTool("draw-polyline");
    renderHook(() => useMapInteraction(view as never));
    clickAt(view, -111.5, 46.5);
    clickAt(view, -111.4, 46.6);
    dblClick(view);
    expect(spies.addShape).toHaveBeenCalledWith(expect.objectContaining({ shape: "polyline" }));
  });
});

describe("useMapInteraction — drop-waypoint (single tap)", () => {
  it("saves a waypoint and clears the tool on a valid tap", () => {
    const view = makeView();
    setTool("drop-waypoint");
    renderHook(() => useMapInteraction(view as never));
    clickAt(view, -111.5, 46.5);
    expect(spies.addWaypoint).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "general", lat: 46.5, lon: -111.5 }),
    );
    expect(spies.clearActiveTool).toHaveBeenCalledTimes(1);
  });

  it("ignores a tap with non-finite coordinates", () => {
    const view = makeView();
    setTool("drop-waypoint");
    renderHook(() => useMapInteraction(view as never));
    clickAt(view, Number.NaN, 46.5);
    expect(spies.addWaypoint).not.toHaveBeenCalled();
    expect(spies.clearActiveTool).not.toHaveBeenCalled();
  });

  it("tolerates a tap whose mapPoint is null (single-tap handler guards it)", () => {
    const view = makeView();
    setTool("drop-waypoint");
    renderHook(() => useMapInteraction(view as never));
    // Unlike the sketch handler, drop-waypoint reads e.mapPoint?.latitude, so a
    // null mapPoint is a safe no-op rather than a throw.
    expect(() => clickNullMapPoint(view)).not.toThrow();
    expect(spies.addWaypoint).not.toHaveBeenCalled();
  });
});

describe("useMapInteraction — select-offline-aoi", () => {
  it("delegates to attachAoiRectangle and commits the bbox on completion", () => {
    const view = makeView();
    setTool("select-offline-aoi");
    renderHook(() => useMapInteraction(view as never));
    expect(spies.attachAoiRectangle).toHaveBeenCalledTimes(1);
    // Invoke the onComplete callback the hook passed in.
    const opts = spies.attachAoiRectangle.mock.calls[0][1] as {
      onComplete: (b: unknown) => void;
    };
    const bbox = { xmin: -112, ymin: 46, xmax: -111, ymax: 47 };
    opts.onComplete(bbox);
    expect(spies.setAoiDraft).toHaveBeenCalledWith(bbox);
    expect(spies.clearActiveTool).toHaveBeenCalledTimes(1);
  });

  it("detaches the AOI helper on unmount", () => {
    const view = makeView();
    setTool("select-offline-aoi");
    const { unmount } = renderHook(() => useMapInteraction(view as never));
    unmount();
    expect(spies.detachAoi).toHaveBeenCalledTimes(1);
  });
});

describe("useMapInteraction — Escape + cleanup", () => {
  it("cancels an in-progress sketch session on Escape without saving", () => {
    const view = makeView();
    setTool("draw-polygon");
    renderHook(() => useMapInteraction(view as never));
    clickAt(view, -111.5, 46.5);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(spies.addShape).not.toHaveBeenCalled();
    expect(spies.clearActiveTool).toHaveBeenCalledTimes(1);
  });

  it("removes click + double-click handlers on unmount", () => {
    const view = makeView();
    setTool("draw-polygon");
    const { unmount } = renderHook(() => useMapInteraction(view as never));
    expect(view.removeSpies.length).toBe(2); // click + double-click
    unmount();
    for (const remove of view.removeSpies) expect(remove).toHaveBeenCalledTimes(1);
  });
});
