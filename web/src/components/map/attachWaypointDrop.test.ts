/**
 * @file attachWaypointDrop.test.ts
 * @module engage-mt/map
 * @description Unit tests for the long-press / right-click "drop a waypoint here"
 *              wiring. A fake ArcGIS MapView captures the `hold` handler + the
 *              contextmenu listener; the field-tools + interaction stores and the
 *              pulse/toTapPoint leaf helpers are mocked at the import seam. The
 *              tests drive: the active-tool guard (no drop while a draw/measure
 *              tool is active), the null-coordinate guard, the drop → addWaypoint
 *              → setLastCreated → emit pipeline (with active-trip assignment),
 *              the right-click bridge (preventDefault + screen→map projection),
 *              and detach removing both listeners.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  activeTool: "none" as string,
  activeTripId: null as string | null,
}));
const spies = vi.hoisted(() => ({
  addWaypoint: vi.fn((input: Record<string, unknown>) => ({
    id: "wp-1",
    name: input.name,
    kind: input.kind,
    lat: input.lat,
    lon: input.lon,
    createdAt: "2026-07-03T00:00:00Z",
    updatedAt: "2026-07-03T00:00:00Z",
  })),
  setLastCreated: vi.fn(),
  pulseAtPoint: vi.fn(),
  toTapPoint: vi.fn(() => ({ x: 1, y: 2, latitude: 46, longitude: -111 })),
}));

vi.mock("@/store/map/mapInteractionStore", () => ({
  useMapInteractionStore: { getState: () => ({ activeTool: state.activeTool }) },
}));
vi.mock("@/store/field/fieldToolsStore", () => ({
  useFieldToolsStore: {
    getState: () => ({
      addWaypoint: spies.addWaypoint,
      setLastCreated: spies.setLastCreated,
      activeTripId: state.activeTripId,
    }),
  },
}));
vi.mock("./selectionPulse", () => ({ pulseAtPoint: spies.pulseAtPoint }));
vi.mock("./tapQuery/toTapPoint", () => ({ toTapPoint: spies.toTapPoint }));

import { attachWaypointDrop } from "./attachWaypointDrop";

/** Fake MapView that records event handlers + a container element. */
const makeView = () => {
  const holdHandlers: Array<(e: { mapPoint: unknown }) => void> = [];
  const container = document.createElement("div");
  const holdRemove = vi.fn();
  const view = {
    container,
    on: vi.fn((event: string, cb: (e: { mapPoint: unknown }) => void) => {
      if (event === "hold") holdHandlers.push(cb);
      return { remove: holdRemove };
    }),
    toMap: vi.fn((sp: { x: number; y: number }) => ({
      latitude: 45 + sp.y / 100,
      longitude: -110 - sp.x / 100,
    })),
  } as unknown as __esri.MapView & { toMap: ReturnType<typeof vi.fn> };
  return { view, holdHandlers, container, holdRemove };
};

const mapPoint = (latitude: number | null, longitude: number | null) =>
  ({ latitude, longitude }) as __esri.Point;

beforeEach(() => {
  vi.clearAllMocks();
  state.activeTool = "none";
  state.activeTripId = null;
});

describe("attachWaypointDrop — hold (long-press)", () => {
  it("drops a waypoint at the hold point and emits it through the FeatureCard pipeline", () => {
    const { view, holdHandlers } = makeView();
    const emit = vi.fn();
    attachWaypointDrop({ view, emit });

    holdHandlers[0]({ mapPoint: mapPoint(46.5, -111.5) });

    expect(spies.addWaypoint).toHaveBeenCalledTimes(1);
    const wpInput = spies.addWaypoint.mock.calls[0][0];
    expect(wpInput).toMatchObject({ kind: "general", lat: 46.5, lon: -111.5 });
    expect(spies.setLastCreated).toHaveBeenCalledWith("wp-1");
    expect(spies.pulseAtPoint).toHaveBeenCalled();

    const [results, tapPoint] = emit.mock.calls[0];
    expect(results[0].layerId).toBe("engage-mt-field-waypoint");
    expect(results[0].features[0]).toMatchObject({ __feature_kind: "waypoint", id: "wp-1" });
    expect(tapPoint).toEqual({ x: 1, y: 2, latitude: 46, longitude: -111 });
  });

  it("assigns the active trip when one is selected", () => {
    state.activeTripId = "trip-9";
    const { view, holdHandlers } = makeView();
    attachWaypointDrop({ view, emit: vi.fn() });
    holdHandlers[0]({ mapPoint: mapPoint(46, -111) });
    expect(spies.addWaypoint.mock.calls[0][0].tripId).toBe("trip-9");
  });

  it("does NOT drop when a draw/measure tool is active", () => {
    state.activeTool = "measure-distance";
    const { view, holdHandlers } = makeView();
    attachWaypointDrop({ view, emit: vi.fn() });
    holdHandlers[0]({ mapPoint: mapPoint(46, -111) });
    expect(spies.addWaypoint).not.toHaveBeenCalled();
  });

  it("guards against a null-coordinate map point", () => {
    const { view, holdHandlers } = makeView();
    attachWaypointDrop({ view, emit: vi.fn() });
    holdHandlers[0]({ mapPoint: mapPoint(null, null) });
    expect(spies.addWaypoint).not.toHaveBeenCalled();
  });

  it("ignores a hold event with no mapPoint", () => {
    const { view, holdHandlers } = makeView();
    attachWaypointDrop({ view, emit: vi.fn() });
    holdHandlers[0]({ mapPoint: null });
    expect(spies.addWaypoint).not.toHaveBeenCalled();
  });
});

describe("attachWaypointDrop — right-click (contextmenu bridge)", () => {
  const dispatchContextMenu = (container: HTMLElement) => {
    const evt = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 300,
    });
    container.dispatchEvent(evt);
    return evt;
  };

  it("projects screen→map, prevents the browser menu, and drops a waypoint", () => {
    const { view, container } = makeView();
    attachWaypointDrop({ view, emit: vi.fn() });
    const evt = dispatchContextMenu(container);
    expect(evt.defaultPrevented).toBe(true);
    expect(view.toMap).toHaveBeenCalled();
    expect(spies.addWaypoint).toHaveBeenCalledTimes(1);
  });

  it("does not drop on right-click while a tool is active", () => {
    state.activeTool = "shape";
    const { view, container } = makeView();
    attachWaypointDrop({ view, emit: vi.fn() });
    dispatchContextMenu(container);
    expect(spies.addWaypoint).not.toHaveBeenCalled();
  });
});

describe("attachWaypointDrop — detach", () => {
  it("removes the hold handle and the contextmenu listener", () => {
    const { view, container, holdRemove } = makeView();
    const detach = attachWaypointDrop({ view, emit: vi.fn() });
    detach();
    expect(holdRemove).toHaveBeenCalledTimes(1);
    // A right-click after detach no longer drops.
    container.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(spies.addWaypoint).not.toHaveBeenCalled();
  });
});
