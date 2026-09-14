/**
 * @file tapQueryHelpers.test.ts
 * @module engage-mt/map
 * @description Unit tests for the tap-query pipeline helpers.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-16
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { queryFeatureLayers } from "./tapQueryHelpers";
import type { LayerDef } from "@/types/layers";
import type { TapQueryFailure } from "@/store/map/tapQueryFailureStore";
import type Point from "@arcgis/core/geometry/Point";

// ---------------------------------------------------------------------------
// Minimal stubs
// ---------------------------------------------------------------------------

const MOCK_MAP_POINT = {
  longitude: -111.0,
  latitude: 46.5,
} as unknown as Point;

function makeLayerDef(overrides: Partial<LayerDef> = {}): LayerDef {
  return {
    id: "test-layer",
    module: "hunt",
    title: "Test Layer",
    url: "https://example.com/FeatureServer/0",
    source: "fwp-public-hub",
    defaultVisible: true,
    freshness: "daily",
    geometry: "point",
    ...overrides,
  } as LayerDef;
}

function makeFeatureLayer(features: Record<string, unknown>[], throwError?: Error) {
  return {
    queryFeatures: vi.fn(() => {
      if (throwError) return Promise.reject(throwError);
      return Promise.resolve({ features: features.map((attrs) => ({ attributes: attrs })) });
    }),
  };
}

// ---------------------------------------------------------------------------
// queryFeatureLayers
// ---------------------------------------------------------------------------

describe("queryFeatureLayers", () => {
  let recordFailure: (f: TapQueryFailure) => void;

  beforeEach(() => {
    recordFailure = vi.fn();
  });

  it("returns empty array when pairs is empty", async () => {
    const results = await queryFeatureLayers({
      pairs: [],
      mapPoint: MOCK_MAP_POINT,
      tolMeters: 50,
      maxResults: 5,
      timeoutMs: 5000,
      recordFailure,
    });
    expect(results).toEqual([]);
  });

  it("returns a TapQueryResult for each layer that has features", async () => {
    const def = makeLayerDef({ id: "hunting-districts" });
    const layer = makeFeatureLayer([{ DISTNAME: "District 380" }]);
    const results = await queryFeatureLayers({
      pairs: [[def, layer as never]],
      mapPoint: MOCK_MAP_POINT,
      tolMeters: 50,
      maxResults: 5,
      timeoutMs: 5000,
      recordFailure,
    });
    expect(results).toHaveLength(1);
    expect(results[0].layerId).toBe("hunting-districts");
    expect(results[0].features).toEqual([{ DISTNAME: "District 380" }]);
  });

  it("skips layers that return no features", async () => {
    const def = makeLayerDef();
    const layer = makeFeatureLayer([]);
    const results = await queryFeatureLayers({
      pairs: [[def, layer as never]],
      mapPoint: MOCK_MAP_POINT,
      tolMeters: 50,
      maxResults: 5,
      timeoutMs: 5000,
      recordFailure,
    });
    expect(results).toEqual([]);
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it("records a 'timeout' failure when the query rejects with a timeout message", async () => {
    const def = makeLayerDef({ id: "fas" });
    const layer = makeFeatureLayer([], new Error("tap-query timeout after 5000ms"));
    const results = await queryFeatureLayers({
      pairs: [[def, layer as never]],
      mapPoint: MOCK_MAP_POINT,
      tolMeters: 50,
      maxResults: 5,
      timeoutMs: 5000,
      recordFailure,
    });
    expect(results).toEqual([]);
    expect(recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ layerId: "fas", reason: "timeout" }),
    );
  });

  it("records a 'network' failure when the query rejects with a TypeError", async () => {
    const def = makeLayerDef({ id: "bma" });
    const layer = makeFeatureLayer([], new TypeError("Failed to fetch"));
    const results = await queryFeatureLayers({
      pairs: [[def, layer as never]],
      mapPoint: MOCK_MAP_POINT,
      tolMeters: 50,
      maxResults: 5,
      timeoutMs: 5000,
      recordFailure,
    });
    expect(results).toEqual([]);
    expect(recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ layerId: "bma", reason: "network" }),
    );
  });

  it("records an 'unknown' failure for other errors", async () => {
    const def = makeLayerDef({ id: "state-parks" });
    const layer = makeFeatureLayer([], new Error("Something unexpected"));
    await queryFeatureLayers({
      pairs: [[def, layer as never]],
      mapPoint: MOCK_MAP_POINT,
      tolMeters: 50,
      maxResults: 5,
      timeoutMs: 5000,
      recordFailure,
    });
    expect(recordFailure).toHaveBeenCalledWith(expect.objectContaining({ reason: "unknown" }));
  });

  it("collects results from multiple layers independently", async () => {
    const def1 = makeLayerDef({ id: "layer-a" });
    const def2 = makeLayerDef({ id: "layer-b" });
    const layer1 = makeFeatureLayer([{ A: 1 }]);
    const layer2 = makeFeatureLayer([{ B: 2 }]);
    const results = await queryFeatureLayers({
      pairs: [
        [def1, layer1 as never],
        [def2, layer2 as never],
      ],
      mapPoint: MOCK_MAP_POINT,
      tolMeters: 50,
      maxResults: 5,
      timeoutMs: 5000,
      recordFailure,
    });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.layerId)).toEqual(["layer-a", "layer-b"]);
  });

  it("uses 0 distance (no buffer) for polygon layers", async () => {
    const def = makeLayerDef({ geometry: "polygon" });
    const layer = makeFeatureLayer([{ NAME: "BMA" }]);
    await queryFeatureLayers({
      pairs: [[def, layer as never]],
      mapPoint: MOCK_MAP_POINT,
      tolMeters: 50,
      maxResults: 5,
      timeoutMs: 5000,
      recordFailure,
    });
    expect(layer.queryFeatures).toHaveBeenCalledWith(expect.objectContaining({ distance: 0 }));
  });

  it("uses tolMeters buffer for point layers", async () => {
    const def = makeLayerDef({ geometry: "point" });
    const layer = makeFeatureLayer([{ ID: 1 }]);
    await queryFeatureLayers({
      pairs: [[def, layer as never]],
      mapPoint: MOCK_MAP_POINT,
      tolMeters: 75,
      maxResults: 5,
      timeoutMs: 5000,
      recordFailure,
    });
    expect(layer.queryFeatures).toHaveBeenCalledWith(
      expect.objectContaining({ distance: 75, units: "meters" }),
    );
  });
});
