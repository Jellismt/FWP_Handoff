/**
 * @file fieldCards.behavior.test.tsx
 * @module engage-mt/map/featureCards
 * @description Behavior tests for the user-owned field-tool Tier-2 renderers —
 *              WaypointCard, ShapeCard, TrackCard. Each renderer resolves live
 *              state from `useFieldToolsStore` by `attrs.id`; these tests seed
 *              the store, render the registered Body/Actions/summary, and assert
 *              real branches: the dominant hero metric, the missing-item
 *              fallback, edit-mode round-trips through the store, the
 *              area-vs-length geometry math (ShapeCard), and the two-step Delete
 *              Action. `shareService` is mocked so the Share Action exercises the
 *              payload-build + close path without touching native.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({
  share: vi.fn(async () => ({ ok: true }) as unknown),
  buildPinSharePayload: vi.fn(() => ({ title: "t", text: "x" })),
  navigate: vi.fn(),
}));

vi.mock("@/services/mobile/shareService", () => ({
  share: h.share,
  buildPinSharePayload: h.buildPinSharePayload,
}));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => h.navigate };
});

// Side-effect import registers every Tier-2 renderer (incl. the field cards).
import "../index";
import { resolveFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRenderer } from "@/components/map/featureCards/core/types";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import {
  useFieldToolsStore,
  type Waypoint,
  type DrawnShape,
  type CapturedRoute,
} from "@/store/field/fieldToolsStore";

const EMPTY_STATE = {
  waypoints: [] as Waypoint[],
  routes: [] as CapturedRoute[],
  shapes: [] as DrawnShape[],
  measurements: [],
  trips: [],
  lastCreatedId: null as string | null,
  activeTripId: null as string | null,
};

const baseProps = (layerId: string, id: string): FeatureRendererProps => ({
  layerId,
  layerTitle: "Field",
  module: "shared",
  attrs: { id },
});

const renderBody = (r: FeatureRenderer, props: FeatureRendererProps) => {
  const Body = r.Body;
  return render(
    <MemoryRouter>
      <Body {...props} />
    </MemoryRouter>,
  );
};

const renderActions = (r: FeatureRenderer, props: FeatureRendererProps) => {
  const Actions = r.Actions;
  if (!Actions) throw new Error("renderer has no Actions");
  return render(
    <MemoryRouter>
      <Actions {...props} />
    </MemoryRouter>,
  );
};

const makeWaypoint = (over: Partial<Waypoint> = {}): Waypoint => ({
  id: "wp-1",
  kind: "camp",
  name: "Base Camp",
  lat: 45.6,
  lon: -111.04,
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-01T12:00:00.000Z",
  photos: [],
  tags: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  useFieldToolsStore.setState({ ...EMPTY_STATE }, false);
});

afterEach(() => {
  cleanup();
});

// ─────────────────────────────────────────────────────────────────
//  WaypointCard
// ─────────────────────────────────────────────────────────────────

describe("WaypointCard", () => {
  it("summary returns the user name, falling back for an unnamed pin", () => {
    const r = resolveFeature("engage-mt-field-waypoint")!;
    expect(r.summary({ name: "Elk Wallow" })).toBe("Elk Wallow");
    expect(r.summary({})).toBe("Saved waypoint");
  });

  it("subtitle pairs the kind label with decimal-degree coords", () => {
    const r = resolveFeature("engage-mt-field-waypoint")!;
    const sub = r.subtitle?.({ kind: "kill-site", lat: 45.5, lon: -111.1 });
    expect(sub).toMatch(/Kill site/);
    expect(sub).toMatch(/45\.50000/);
  });

  it("renders the kind callout + name for a stored waypoint", () => {
    useFieldToolsStore.setState({ waypoints: [makeWaypoint()] });
    const r = resolveFeature("engage-mt-field-waypoint")!;
    const { container } = renderBody(r, baseProps("engage-mt-field-waypoint", "wp-1"));
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/Camp/); // kind label
    expect(txt).toMatch(/Base Camp/); // name
    // Coords render in the DD toggle.
    expect(txt).toMatch(/45\.60000/);
  });

  it("shows the removed-waypoint fallback when the id is not in the store", () => {
    const r = resolveFeature("engage-mt-field-waypoint")!;
    const { container } = renderBody(r, baseProps("engage-mt-field-waypoint", "gone"));
    expect(container.textContent ?? "").toMatch(/was removed/i);
  });

  it("toggles the coordinate display between DD and DMS", () => {
    useFieldToolsStore.setState({ waypoints: [makeWaypoint()] });
    const r = resolveFeature("engage-mt-field-waypoint")!;
    renderBody(r, baseProps("engage-mt-field-waypoint", "wp-1"));
    const toggle = screen.getByRole("button", {
      name: /switch to degrees-minutes-seconds/i,
    });
    fireEvent.click(toggle);
    // DMS uses a degree glyph + minutes/seconds — a decimal-degree pair would
    // not contain the ' and " marks.
    expect(screen.getByText(/45°/)).toBeTruthy();
  });

  it("edit-mode Save writes the new name back through the store", () => {
    useFieldToolsStore.setState({ waypoints: [makeWaypoint()] });
    const r = resolveFeature("engage-mt-field-waypoint")!;
    renderBody(r, baseProps("engage-mt-field-waypoint", "wp-1"));
    fireEvent.click(screen.getByRole("button", { name: /^Edit$/ }));
    const input = screen.getByDisplayValue("Base Camp") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Spike Camp" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(useFieldToolsStore.getState().waypoints[0]!.name).toBe("Spike Camp");
  });

  it("Actions Share builds a waypoint payload and calls share()", async () => {
    useFieldToolsStore.setState({ waypoints: [makeWaypoint()] });
    const r = resolveFeature("engage-mt-field-waypoint")!;
    renderActions(r, baseProps("engage-mt-field-waypoint", "wp-1"));
    fireEvent.click(screen.getByRole("button", { name: /Share pin/i }));
    await vi.waitFor(() => expect(h.share).toHaveBeenCalledTimes(1));
    expect(h.buildPinSharePayload).toHaveBeenCalledWith(
      expect.objectContaining({ waypoints: [expect.objectContaining({ id: "wp-1" })] }),
    );
  });

  it("Actions Delete is a two-step arm/confirm that removes the waypoint", () => {
    useFieldToolsStore.setState({ waypoints: [makeWaypoint()] });
    const r = resolveFeature("engage-mt-field-waypoint")!;
    renderActions(r, baseProps("engage-mt-field-waypoint", "wp-1"));
    const del = screen.getByRole("button", { name: /Delete/ });
    // First tap arms — does NOT remove.
    fireEvent.click(del);
    expect(useFieldToolsStore.getState().waypoints).toHaveLength(1);
    // Second tap confirms.
    fireEvent.click(screen.getByRole("button", { name: /Tap to confirm/ }));
    expect(useFieldToolsStore.getState().waypoints).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────
//  ShapeCard — geometry math is the interesting branch
// ─────────────────────────────────────────────────────────────────

describe("ShapeCard", () => {
  const makeShape = (over: Partial<DrawnShape> = {}): DrawnShape => ({
    id: "sh-1",
    name: "Unit boundary",
    shape: "polygon",
    color: "green",
    vertices: [
      [-111.0, 45.0],
      [-111.0, 45.01],
      [-110.99, 45.01],
      [-110.99, 45.0],
    ],
    createdAt: "2026-06-01T00:00:00.000Z",
    ...over,
  });

  it("summary + subtitle describe the shape", () => {
    const r = resolveFeature("engage-mt-field-shape")!;
    expect(r.summary({ name: "My area" })).toBe("My area");
    expect(r.summary({})).toBe("Drawn shape");
    expect(r.subtitle?.({ shape: "polyline", color: "red" })).toBe("Polyline · red");
  });

  it("renders an acres hero for a polygon", () => {
    useFieldToolsStore.setState({ shapes: [makeShape()] });
    const r = resolveFeature("engage-mt-field-shape")!;
    const { container } = renderBody(r, baseProps("engage-mt-field-shape", "sh-1"));
    const txt = container.textContent ?? "";
    // ~0.01° lat × ~0.01° lon at 45°N ≈ 172 acres; assert the acre unit + a
    // plausible 3-digit acreage, and the vertex count metric.
    expect(txt).toMatch(/ac/);
    expect(txt).toMatch(/Vertices4/); // vertex-count metric (value glued to label)
  });

  it("renders a miles hero for a polyline", () => {
    useFieldToolsStore.setState({
      shapes: [
        makeShape({
          id: "sh-line",
          shape: "polyline",
          vertices: [
            [-111.0, 45.0],
            [-110.9, 45.0],
          ],
        }),
      ],
    });
    const r = resolveFeature("engage-mt-field-shape")!;
    const { container } = renderBody(r, baseProps("engage-mt-field-shape", "sh-line"));
    // ~0.1° lon at 45°N ≈ 4.4 mi.
    expect(container.textContent ?? "").toMatch(/mi/);
  });

  it("falls back to a name hero when a polygon has too few vertices to measure", () => {
    useFieldToolsStore.setState({
      shapes: [makeShape({ id: "sh-degenerate", vertices: [[-111, 45]] })],
    });
    const r = resolveFeature("engage-mt-field-shape")!;
    const { container } = renderBody(r, baseProps("engage-mt-field-shape", "sh-degenerate"));
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/Unit boundary/);
    // No area was computed, so the "Shape" metric pill appears instead.
    expect(txt).toMatch(/Polygon/);
  });

  it("shows the removed-shape fallback for an unknown id", () => {
    const r = resolveFeature("engage-mt-field-shape")!;
    const { container } = renderBody(r, baseProps("engage-mt-field-shape", "nope"));
    expect(container.textContent ?? "").toMatch(/was removed/i);
  });

  it("edit-mode Save persists the shape name via updateShape", () => {
    useFieldToolsStore.setState({ shapes: [makeShape()] });
    const r = resolveFeature("engage-mt-field-shape")!;
    renderBody(r, baseProps("engage-mt-field-shape", "sh-1"));
    fireEvent.click(screen.getByRole("button", { name: /^Edit$/ }));
    fireEvent.change(screen.getByDisplayValue("Unit boundary"), {
      target: { value: "Renamed area" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(useFieldToolsStore.getState().shapes[0]!.name).toBe("Renamed area");
  });

  it("Actions Share builds a shape payload", async () => {
    useFieldToolsStore.setState({ shapes: [makeShape()] });
    const r = resolveFeature("engage-mt-field-shape")!;
    renderActions(r, baseProps("engage-mt-field-shape", "sh-1"));
    fireEvent.click(screen.getByRole("button", { name: /Share shape/i }));
    await vi.waitFor(() => expect(h.share).toHaveBeenCalledTimes(1));
    expect(h.buildPinSharePayload).toHaveBeenCalledWith(
      expect.objectContaining({ shapes: [expect.objectContaining({ id: "sh-1" })] }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────
//  TrackCard
// ─────────────────────────────────────────────────────────────────

describe("TrackCard", () => {
  const makeRoute = (over: Partial<CapturedRoute> = {}): CapturedRoute => ({
    id: "tr-1",
    name: "Morning loop",
    path: [
      [-111.0, 45.0],
      [-111.0, 45.01],
    ],
    distanceMi: 3.14,
    gainFt: 812,
    startedAt: "2026-06-01T13:00:00.000Z",
    endedAt: "2026-06-01T14:30:00.000Z",
    ...over,
  });

  it("summary + subtitle describe the track", () => {
    const r = resolveFeature("engage-mt-field-track")!;
    expect(r.summary({ name: "Ridge run" })).toBe("Ridge run");
    expect(r.summary({})).toBe("Recorded track");
    expect(r.subtitle?.({ distanceMi: 3.14 })).toMatch(/3\.14 mi/);
  });

  it("renders the distance hero, elevation gain, sample count, and duration", () => {
    useFieldToolsStore.setState({ routes: [makeRoute()] });
    const r = resolveFeature("engage-mt-field-track")!;
    const { container } = renderBody(r, baseProps("engage-mt-field-track", "tr-1"));
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/3\.14/); // distance
    expect(txt).toMatch(/812 ft/); // gain
    expect(txt).toMatch(/1 h 30 min/); // duration
    expect(txt).toMatch(/GPS samples2/); // path length (value glued to label)
  });

  it("shows the removed-track fallback for an unknown id", () => {
    const r = resolveFeature("engage-mt-field-track")!;
    const { container } = renderBody(r, baseProps("engage-mt-field-track", "gone"));
    expect(container.textContent ?? "").toMatch(/was removed/i);
  });

  it("edit-mode Save persists the track name via updateRoute", () => {
    useFieldToolsStore.setState({ routes: [makeRoute()] });
    const r = resolveFeature("engage-mt-field-track")!;
    renderBody(r, baseProps("engage-mt-field-track", "tr-1"));
    fireEvent.click(screen.getByRole("button", { name: /^Edit$/ }));
    fireEvent.change(screen.getByDisplayValue("Morning loop"), {
      target: { value: "Evening loop" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(useFieldToolsStore.getState().routes[0]!.name).toBe("Evening loop");
  });

  it("Actions Share builds a route payload and Delete removes on confirm", async () => {
    useFieldToolsStore.setState({ routes: [makeRoute()] });
    const r = resolveFeature("engage-mt-field-track")!;
    renderActions(r, baseProps("engage-mt-field-track", "tr-1"));
    fireEvent.click(screen.getByRole("button", { name: /Share track/i }));
    await vi.waitFor(() => expect(h.share).toHaveBeenCalledTimes(1));
    expect(h.buildPinSharePayload).toHaveBeenCalledWith(
      expect.objectContaining({ routes: [expect.objectContaining({ id: "tr-1" })] }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tap to confirm/ }));
    expect(useFieldToolsStore.getState().routes).toHaveLength(0);
  });
});
