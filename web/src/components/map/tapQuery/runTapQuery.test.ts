/**
 * @file runTapQuery.test.ts
 * @module engage-mt/map
 * @description Unit tests for the tap-query click pipeline orchestrator. The
 *              async collaborators (FeatureLayer query helper,
 *              land-ownership resolver, pulse + highlight bridges, topmost
 *              resolver) are mocked at the import seam so we assert on the
 *              stage priority order, early returns, and the shape emitted to
 *              the panel — not real ArcGIS rendering. Covers: draw-tool guard,
 *              field-graphics priority, gage graphics hit-tests,
 *              the cluster auto-zoom early return, the FeatureLayer query
 *              stage, the Living-Atlas portal fallback, the bare-land
 *              ownership fallback, and the resolution-fallback path where
 *              `view.resolution` is absent and the hit tolerance must be
 *              derived from `extent.width / view.width`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-07
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type Layer from "@arcgis/core/layers/Layer";
import type { TapQueryResult } from "../TapQueryPanel";

// ── Collaborators mocked at the seam ─────────────────────────────────────
const h = vi.hoisted(() => ({
  queryFeatureLayers: vi.fn(),
  resolveLandOwnershipAtPoint: vi.fn(),
  pulseAtPoint: vi.fn(),
  highlightTapQueryHit: vi.fn(),
  resolveTopmost: vi.fn(),
  decideClusterZoom: vi.fn(),
  collectRegisteredHitLayerIds: vi.fn(() => [] as string[]),
  activeTool: "none" as string,
  visible: {} as Record<string, boolean>,
  clearFailures: vi.fn(),
  recordFailure: vi.fn(),
}));

// FeatureLayer is used with `instanceof` in the source; provide a real
// constructable shell so the pair-filtering works.
vi.mock("@arcgis/core/layers/FeatureLayer", () => ({ default: class FeatureLayer {} }));

vi.mock("./tapQueryHelpers", () => ({
  queryFeatureLayers: h.queryFeatureLayers,
}));
vi.mock("@/services/spatialContext/landOwnership", () => ({
  resolveLandOwnershipAtPoint: h.resolveLandOwnershipAtPoint,
}));
vi.mock("../selectionPulse", () => ({ pulseAtPoint: h.pulseAtPoint }));
vi.mock("@/services/map/tapQueryHighlightBridge", () => ({
  highlightTapQueryHit: h.highlightTapQueryHit,
}));
vi.mock("./resolveTopmost", () => ({
  resolveTopmost: h.resolveTopmost,
  decideClusterZoom: h.decideClusterZoom,
  collectRegisteredHitLayerIds: h.collectRegisteredHitLayerIds,
}));
vi.mock("@/store/map/mapInteractionStore", () => ({
  useMapInteractionStore: { getState: () => ({ activeTool: h.activeTool }) },
}));
vi.mock("@/store/map/layerVisibilityStore", () => ({
  useLayerVisibilityStore: { getState: () => ({ visible: h.visible }) },
}));
vi.mock("@/store/map/tapQueryFailureStore", () => ({
  useTapQueryFailureStore: {
    getState: () => ({ clear: h.clearFailures, recordFailure: h.recordFailure }),
  },
}));

// Keep the real LAYER_REGISTRY, cluster helper, and constants — the source
// resolves LayerDefs (title/module) from them and we want that real behavior.

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { runTapQuery, type TapQueryContext } from "./runTapQuery";

// ── Fakes ────────────────────────────────────────────────────────────────
interface FakeGraphicHit {
  type: "graphic";
  graphic: { attributes?: Record<string, unknown> };
}

const makeMapPoint = (lon = -111.5, lat = 46.5): __esri.Point =>
  ({
    x: lon,
    y: lat,
    longitude: lon,
    latitude: lat,
    spatialReference: { wkid: 4326 },
  }) as unknown as __esri.Point;

interface FakeView {
  hitTest: ReturnType<typeof vi.fn>;
  goTo: ReturnType<typeof vi.fn>;
  resolution: number;
  scale: number;
  zoom: number;
}

const makeCtx = (
  over: {
    findLayerById?: (id: string) => Layer | null;
    layerIndex?: Map<string, Layer>;
    hitTest?: ReturnType<typeof vi.fn>;
  } = {},
): { ctx: TapQueryContext; emit: ReturnType<typeof vi.fn>; view: FakeView } => {
  const emit = vi.fn();
  const view: FakeView = {
    hitTest: over.hitTest ?? vi.fn().mockResolvedValue({ results: [] }),
    goTo: vi.fn().mockResolvedValue(undefined),
    resolution: 10,
    scale: 100_000,
    zoom: 8,
  };
  const map = {
    findLayerById: over.findLayerById ?? ((): Layer | null => null),
  };
  const ctx: TapQueryContext = {
    view: view as unknown as __esri.MapView,
    map: map as unknown as __esri.Map,
    layerIndex: over.layerIndex ?? new Map<string, Layer>(),
    emit,
  };
  return { ctx, emit, view };
};

const graphicHit = (attributes?: Record<string, unknown>): FakeGraphicHit => ({
  type: "graphic",
  graphic: { attributes },
});

const makeEvent = (): __esri.ViewClickEvent =>
  ({ mapPoint: makeMapPoint() }) as unknown as __esri.ViewClickEvent;

beforeEach(() => {
  vi.clearAllMocks();
  h.activeTool = "none";
  h.visible = {};
  // Default: nothing resolved as topmost, no cluster zoom, empty query stages.
  h.resolveTopmost.mockReturnValue({
    topLayerId: null,
    topGraphicAttrs: null,
    topGraphic: undefined,
  });
  h.decideClusterZoom.mockReturnValue({ shouldZoom: false, clearAttrs: false, targetZoom: 8 });
  h.queryFeatureLayers.mockResolvedValue([]);
  h.resolveLandOwnershipAtPoint.mockResolvedValue({ kind: "none" });
});

describe("runTapQuery — guards", () => {
  it("does nothing while a draw/measure tool is active", async () => {
    h.activeTool = "measure-distance";
    const { ctx, emit } = makeCtx();
    await runTapQuery(makeEvent(), ctx);
    expect(emit).not.toHaveBeenCalled();
    expect(h.clearFailures).not.toHaveBeenCalled();
  });

  it("clears prior tap-query failures at the start of a live tap", async () => {
    const { ctx } = makeCtx();
    await runTapQuery(makeEvent(), ctx);
    expect(h.clearFailures).toHaveBeenCalledTimes(1);
  });
});

describe("runTapQuery — priority stages", () => {
  it("field-tools graphic wins every pixel and short-circuits the pipeline", async () => {
    const fieldLayer = {} as Layer;
    const hitTest = vi.fn().mockResolvedValue({
      results: [graphicHit({ __feature_kind: "waypoint", name: "My spot" })],
    });
    const { ctx, emit } = makeCtx({
      findLayerById: (id) => (id.includes("field") ? fieldLayer : null),
      hitTest,
    });

    await runTapQuery(makeEvent(), ctx);

    expect(emit).toHaveBeenCalledTimes(1);
    const [results] = emit.mock.calls[0] as [TapQueryResult[]];
    expect(results).toHaveLength(1);
    expect(results[0].layerId).toBe("engage-mt-field-waypoint");
    expect(results[0].module).toBe("shared");
    // Operational query stages never ran — the field hit returned early.
    expect(h.queryFeatureLayers).not.toHaveBeenCalled();
    expect(h.pulseAtPoint).toHaveBeenCalled();
  });

  it("falls through the field layer for an in-progress active track (render-only)", async () => {
    const fieldLayer = {} as Layer;
    const hitTest = vi.fn().mockResolvedValue({
      results: [graphicHit({ __feature_kind: "active-track" })],
    });
    const { ctx, emit } = makeCtx({
      findLayerById: (id) => (id.includes("field") ? fieldLayer : null),
      hitTest,
    });

    await runTapQuery(makeEvent(), ctx);

    // Not a waypoint/route/shape → no synthetic field result; pipeline continues
    // to the (empty) operational stages and still emits.
    expect(h.queryFeatureLayers).toHaveBeenCalled();
    const [results] = emit.mock.calls[0] as [TapQueryResult[]];
    expect(results).toHaveLength(0);
  });

  it("emits a USGS gage card from the gages graphics-layer hit-test", async () => {
    const gagesLayer = {} as Layer;
    const layerIndex = new Map<string, Layer>([["usgs-gages", gagesLayer]]);
    const hitTest = vi
      .fn()
      .mockResolvedValue({ results: [graphicHit({ site_no: "06054500", flow: 1200 })] });
    const { ctx, emit } = makeCtx({ layerIndex, hitTest });

    await runTapQuery(makeEvent(), ctx);

    const [results] = emit.mock.calls[0] as [TapQueryResult[]];
    expect(results).toHaveLength(1);
    expect(results[0].layerId).toBe("usgs-gages");
    expect(results[0].module).toBe("fish");
  });
});

describe("runTapQuery — cluster auto-zoom", () => {
  it("flies to the cluster and returns WITHOUT emitting (zoom is the feedback)", async () => {
    const geometry = { type: "point" };
    h.resolveTopmost.mockReturnValue({
      topLayerId: "fishing-access-sites",
      topGraphicAttrs: { cluster_count: 12 },
      topGraphic: { graphic: { geometry } },
    });
    h.decideClusterZoom.mockReturnValue({ shouldZoom: true, clearAttrs: false, targetZoom: 10 });

    const { ctx, emit, view } = makeCtx();
    await runTapQuery(makeEvent(), ctx);

    expect(view.goTo).toHaveBeenCalledTimes(1);
    expect(view.goTo.mock.calls[0][0]).toMatchObject({ target: geometry, zoom: 10 });
    // Deliberately no emit — the next click resolves an individual feature.
    expect(emit).not.toHaveBeenCalled();
  });

  it("clears synthetic aggregate attrs when the cluster decision says so", async () => {
    h.resolveTopmost.mockReturnValue({
      topLayerId: "fishing-access-sites",
      topGraphicAttrs: { cluster_count: 1 },
      topGraphic: { graphic: { geometry: { type: "point" } } },
    });
    h.decideClusterZoom.mockReturnValue({ shouldZoom: false, clearAttrs: true, targetZoom: 8 });
    h.queryFeatureLayers.mockResolvedValue([]);

    const { ctx, emit } = makeCtx();
    await runTapQuery(makeEvent(), ctx);

    // clearAttrs cleared the aggregate → no portal-item fallback card gets built.
    const [results] = emit.mock.calls[0] as [TapQueryResult[]];
    expect(results).toHaveLength(0);
  });
});

describe("runTapQuery — query + fallback stages", () => {
  it("scopes the FeatureLayer query to the topmost layer and emits its results", async () => {
    const fasLayer = new FeatureLayer();
    const layerIndex = new Map<string, Layer>([
      ["fishing-access-sites", fasLayer as unknown as Layer],
    ]);
    h.visible = { "fishing-access-sites": true };
    h.resolveTopmost.mockReturnValue({
      topLayerId: "fishing-access-sites",
      topGraphicAttrs: null,
      topGraphic: undefined,
    });
    h.queryFeatureLayers.mockResolvedValue([
      {
        layerId: "fishing-access-sites",
        layerTitle: "Fishing Access Sites",
        module: "fish",
        features: [{ NAME: "Lone Pine" }],
      },
    ]);

    const { ctx, emit } = makeCtx({ layerIndex });
    await runTapQuery(makeEvent(), ctx);

    // The helper received exactly the topmost layer's pair.
    const passed = h.queryFeatureLayers.mock.calls[0][0] as {
      pairs: ReadonlyArray<readonly [{ id: string }, unknown]>;
    };
    expect(passed.pairs).toHaveLength(1);
    expect(passed.pairs[0][0].id).toBe("fishing-access-sites");

    const [results] = emit.mock.calls[0] as [TapQueryResult[]];
    expect(results).toHaveLength(1);
    expect(results[0].features[0]).toMatchObject({ NAME: "Lone Pine" });
    // A real hit pulses + paints a highlight halo.
    expect(h.pulseAtPoint).toHaveBeenCalled();
    expect(h.highlightTapQueryHit).toHaveBeenCalled();
  });

  it("surfaces a Living-Atlas portal graphic when the query loop came back empty", async () => {
    h.resolveTopmost.mockReturnValue({
      topLayerId: "usgs-gages",
      topGraphicAttrs: { site_no: "06054500" },
      topGraphic: { graphic: { geometry: { type: "point" } } },
    });
    h.queryFeatureLayers.mockResolvedValue([]);

    const { ctx, emit } = makeCtx();
    await runTapQuery(makeEvent(), ctx);

    const [results] = emit.mock.calls[0] as [TapQueryResult[]];
    expect(results).toHaveLength(1);
    expect(results[0].layerId).toBe("usgs-gages");
    expect(results[0].features[0]).toMatchObject({ site_no: "06054500" });
  });

  it("resolves bare-land ownership (cadastral) to the cadastral layer id", async () => {
    h.resolveLandOwnershipAtPoint.mockResolvedValue({
      kind: "cadastral",
      attrs: { OwnerName: "Jane Rancher" },
    });

    const { ctx, emit } = makeCtx();
    await runTapQuery(makeEvent(), ctx);

    const [results] = emit.mock.calls[0] as [TapQueryResult[]];
    expect(results).toHaveLength(1);
    expect(results[0].layerId).toBe("mt-cadastral");
  });

  it("records a cadastral failure instead of an empty result when the service is unreachable", async () => {
    h.resolveLandOwnershipAtPoint.mockResolvedValue({ kind: "unavailable", reason: "timeout" });
    const { ctx } = makeCtx();
    await runTapQuery(makeEvent(), ctx);
    expect(h.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ layerId: "mt-cadastral", reason: "timeout" }),
    );
  });

  it("emits an empty result set with no pulse when nothing hits", async () => {
    const { ctx, emit } = makeCtx();
    await runTapQuery(makeEvent(), ctx);

    expect(emit).toHaveBeenCalledTimes(1);
    const [results, tapPoint] = emit.mock.calls[0] as [TapQueryResult[], unknown];
    expect(results).toHaveLength(0);
    expect(tapPoint).toMatchObject({ latitude: 46.5, longitude: -111.5 });
    // No hit → no pulse, no highlight halo.
    expect(h.pulseAtPoint).not.toHaveBeenCalled();
    expect(h.highlightTapQueryHit).not.toHaveBeenCalled();
  });
});

describe("runTapQuery — resolution-fallback path", () => {
  // A view with NO usable `resolution` property still exposes `extent.width`
  // (map units) + `width` (device px). `resolutionOf(view)` must fall back to
  // extent.width / view.width so the ±18 px point/line hit tolerance never
  // silently collapses to zero.
  const makeResolutionlessCtx = (
    view: Record<string, unknown>,
    layerIndex: Map<string, Layer> = new Map(),
  ): { ctx: TapQueryContext; emit: ReturnType<typeof vi.fn> } => {
    const emit = vi.fn();
    const ctx: TapQueryContext = {
      view: view as unknown as __esri.MapView,
      map: { findLayerById: (): Layer | null => null } as unknown as __esri.Map,
      layerIndex,
      emit,
    };
    return { ctx, emit };
  };

  it("derives hit tolerance from extent.width ÷ view.width and runs the FeatureLayer stage", async () => {
    const fasLayer = new FeatureLayer();
    const layerIndex = new Map<string, Layer>([
      ["fishing-access-sites", fasLayer as unknown as Layer],
    ]);
    h.visible = { "fishing-access-sites": true };
    h.resolveTopmost.mockReturnValue({
      topLayerId: "fishing-access-sites",
      topGraphicAttrs: null,
      topGraphic: undefined,
    });
    h.queryFeatureLayers.mockResolvedValue([
      {
        layerId: "fishing-access-sites",
        layerTitle: "Fishing Access Sites",
        module: "fish",
        features: [{ NAME: "Lone Pine" }],
      },
    ]);

    // extent.width / width = 10 000 / 1 000 = 10 map units/px → tol = 18 × 10.
    const resolutionlessView = {
      hitTest: vi.fn().mockResolvedValue({ results: [] }),
      goTo: vi.fn().mockResolvedValue(undefined),
      extent: { width: 10_000 },
      width: 1_000,
      scale: 100_000,
      zoom: 8,
    };
    expect("resolution" in resolutionlessView).toBe(false); // genuinely resolution-less
    const { ctx, emit } = makeResolutionlessCtx(resolutionlessView, layerIndex);

    await runTapQuery(makeEvent(), ctx);

    const passed = h.queryFeatureLayers.mock.calls[0][0] as {
      tolMeters: number;
      pairs: ReadonlyArray<readonly [{ id: string }, unknown]>;
    };
    expect(passed.tolMeters).toBe(180); // NOT 0 — the extent fallback fired
    expect(passed.pairs).toHaveLength(1);
    expect(passed.pairs[0][0].id).toBe("fishing-access-sites");

    const [results] = emit.mock.calls[0] as [TapQueryResult[]];
    expect(results).toHaveLength(1);
    expect(results[0].features[0]).toMatchObject({ NAME: "Lone Pine" });
  });

  it("yields a 0 tolerance (not NaN) when the view has no usable extent yet", async () => {
    // Before the first frame a view's extent can be null; the helper must
    // return 0 so the pipeline still runs (polygon hits are exact regardless).
    const resolutionlessView = {
      hitTest: vi.fn().mockResolvedValue({ results: [] }),
      goTo: vi.fn().mockResolvedValue(undefined),
      extent: null,
      width: 1_000,
      scale: 100_000,
      zoom: 8,
    };
    const { ctx } = makeResolutionlessCtx(resolutionlessView);

    await runTapQuery(makeEvent(), ctx);

    const passed = h.queryFeatureLayers.mock.calls[0][0] as { tolMeters: number };
    expect(passed.tolMeters).toBe(0);
    expect(Number.isNaN(passed.tolMeters)).toBe(false);
  });
});
