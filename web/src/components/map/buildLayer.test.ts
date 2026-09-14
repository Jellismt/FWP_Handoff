/**
 * @file buildLayer.test.ts
 * @module engage-mt/map
 * @description Unit tests for the ArcGIS layer factory. The @arcgis/core
 *              FeatureLayer constructor is mocked as a recording shell and the
 *              symbology collaborators (getRenderer / clusterReduction /
 *              labelClassesFor) are stubbed at the import seam, so the tests
 *              assert that the Montana `definitionExpression`, outFields
 *              whitelist, renderer, clustering, blend-mode, zoom-gated labels,
 *              z-order, and initial visibility are applied to the constructed
 *              instance. This guards the national-service Montana-scoping seam
 *              (an unfiltered layer would otherwise ship unnoticed — TG-4).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LayerDef } from "@/types/layers";

// ── @arcgis/core recording shells ────────────────────────────────────────
// Each constructed layer records its constructor props AND allows post-construct
// property assignment (renderer / z / featureReduction / labelingInfo etc.),
// exactly as buildLayer does via the `as unknown as { ... }` casts.
const created = vi.hoisted(() => ({
  featureLayers: [] as Record<string, unknown>[],
}));

vi.mock("@arcgis/core/layers/FeatureLayer", () => ({
  default: class {
    constructor(props: Record<string, unknown>) {
      Object.assign(this, props);
      created.featureLayers.push(this as unknown as Record<string, unknown>);
    }
  },
}));

// ── Symbology collaborators (controllable per test) ──────────────────────
const symbology = vi.hoisted(() => ({
  renderer: null as unknown,
  labelClasses: null as unknown[] | null,
  clusterInstance: { type: "cluster" } as unknown,
}));
vi.mock("./symbology", () => ({ getRenderer: () => symbology.renderer }));
vi.mock("./symbology/cluster", () => ({ clusterReduction: () => symbology.clusterInstance }));
vi.mock("./symbology/labels", () => ({ labelClassesFor: () => symbology.labelClasses }));

import { buildLayer } from "./buildLayer";

/** Minimal LayerDef factory — only the fields buildLayer reads matter. */
const makeDef = (overrides: Partial<LayerDef> = {}): LayerDef =>
  ({
    id: "test-layer",
    module: "fish",
    title: "Test Layer",
    url: "https://example.gov/arcgis/rest/services/Foo/FeatureServer/0",
    source: "fwp-public-hub",
    freshness: "static",
    sourceLabel: "Test",
    ...overrides,
  }) as LayerDef;

beforeEach(() => {
  created.featureLayers = [];
  symbology.renderer = null;
  symbology.labelClasses = null;
  symbology.clusterInstance = { type: "cluster" };
});

describe("buildLayer — Montana scoping + core props (FeatureLayer)", () => {
  it("builds a FeatureLayer for a FeatureServer endpoint", () => {
    buildLayer(makeDef(), true);
    expect(created.featureLayers).toHaveLength(1);
  });

  it("passes the definitionExpression through to the constructed FeatureLayer", () => {
    const def = makeDef({ definitionExpression: "POOState='MT'" });
    buildLayer(def, true);
    expect(created.featureLayers[0].definitionExpression).toBe("POOState='MT'");
  });

  it("leaves definitionExpression undefined when the def has none (statewide FWP services)", () => {
    buildLayer(makeDef(), true);
    expect(created.featureLayers[0].definitionExpression).toBeUndefined();
  });

  it("applies initialVisible at construction so default-visible layers paint immediately", () => {
    buildLayer(makeDef(), true);
    expect(created.featureLayers[0].visible).toBe(true);
    buildLayer(makeDef(), false);
    expect(created.featureLayers[1].visible).toBe(false);
  });

  it("whitelists outFields from outFieldsHint, else defaults to ['*']", () => {
    buildLayer(makeDef({ outFieldsHint: ["NAME", "STATUS"] }), true);
    expect(created.featureLayers[0].outFields).toEqual(["NAME", "STATUS"]);
    buildLayer(makeDef(), true);
    expect(created.featureLayers[1].outFields).toEqual(["*"]);
  });

  it("forwards minScale / maxScale", () => {
    buildLayer(makeDef({ minScale: 500000, maxScale: 100 }), true);
    expect(created.featureLayers[0].minScale).toBe(500000);
    expect(created.featureLayers[0].maxScale).toBe(100);
  });
});

describe("buildLayer — symbology application", () => {
  it("assigns a renderer when the dispatcher returns one", () => {
    symbology.renderer = { type: "simple" };
    buildLayer(makeDef(), true);
    expect((created.featureLayers[0] as { renderer: unknown }).renderer).toEqual({
      type: "simple",
    });
  });

  it("does not assign a renderer property when the dispatcher returns null", () => {
    symbology.renderer = null;
    buildLayer(makeDef(), true);
    expect("renderer" in created.featureLayers[0]).toBe(false);
  });

  it("attaches a FeatureReductionCluster only when clustering is enabled", () => {
    buildLayer(makeDef({ symbology: { cluster: { enabled: true } } } as Partial<LayerDef>), true);
    expect((created.featureLayers[0] as { featureReduction: unknown }).featureReduction).toEqual({
      type: "cluster",
    });
    buildLayer(makeDef(), true);
    expect("featureReduction" in created.featureLayers[1]).toBe(false);
  });

  it("sets blendMode='multiply' for overlay-role polygons only", () => {
    buildLayer(makeDef({ symbology: { polygonRole: "overlay" } } as Partial<LayerDef>), true);
    expect((created.featureLayers[0] as { blendMode: string }).blendMode).toBe("multiply");
    buildLayer(makeDef(), true);
    expect("blendMode" in created.featureLayers[1]).toBe(false);
  });

  it("enables labels when labelClassesFor returns classes", () => {
    symbology.labelClasses = [{ symbol: {} }];
    buildLayer(makeDef(), true);
    const l = created.featureLayers[0] as { labelingInfo: unknown[]; labelsVisible: boolean };
    expect(l.labelingInfo).toEqual([{ symbol: {} }]);
    expect(l.labelsVisible).toBe(true);
  });

  it("explicitly nulls out labels + hides them when no label classes (silence service-side labels)", () => {
    symbology.labelClasses = null;
    buildLayer(makeDef(), true);
    const l = created.featureLayers[0] as { labelingInfo: unknown[]; labelsVisible: boolean };
    expect(l.labelingInfo).toEqual([]);
    expect(l.labelsVisible).toBe(false);
  });

  it("does NOT write a phantom `z` property", () => {
    // ArcGIS `Layer` has no `z`; the former assignment was a silent no-op. Real
    // stacking is the map.layers collection order set in attachRegistryLayers.
    buildLayer(makeDef({ zIndex: 42 } as Partial<LayerDef>), true);
    expect("z" in created.featureLayers[0]).toBe(false);
  });
});
