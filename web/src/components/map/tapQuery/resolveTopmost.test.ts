/**
 * @file resolveTopmost.test.ts
 * @module engage-mt/map
 * @description Unit tests for the pure tap-query resolution helpers
 *              (resolveTopmost + decideClusterZoom). Plain objects cast through
 *              `unknown` stand in for ArcGIS hit results — no real SDK instances.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import {
  resolveTopmost,
  resolveRegisteredLid,
  collectRegisteredHitLayerIds,
  decideClusterZoom,
  INFRA_LAYER_IDS,
  type TapHit,
} from "./resolveTopmost";

/** Build a graphic-hit stand-in with a layer chain + optional attributes. */
const graphicHit = (
  layer: unknown,
  attributes?: Record<string, unknown>,
  geometry?: unknown,
): TapHit =>
  ({
    type: "graphic",
    graphic: { layer, attributes, geometry },
  }) as unknown as TapHit;

const REGISTERED = new Set<string>(["fishing-access-sites", "hunting-districts", "wind-stations"]);

describe("resolveRegisteredLid", () => {
  it("returns null for a null layer", () => {
    expect(resolveRegisteredLid(null, REGISTERED)).toBeNull();
  });

  it("resolves a directly-registered layer id", () => {
    const layer = { id: "fishing-access-sites" } as unknown as __esri.Layer;
    expect(resolveRegisteredLid(layer, REGISTERED)).toBe("fishing-access-sites");
  });

  it("walks parent ancestors to a registered id (portal-item child case)", () => {
    // Auto-generated child id whose GroupLayer parent carries our LayerDef id.
    const child = {
      id: "19e943df3ff-layer-90",
      parent: { id: "wind-stations" },
    } as unknown as __esri.Layer;
    expect(resolveRegisteredLid(child, REGISTERED)).toBe("wind-stations");
  });

  it("stops after 6 ancestor hops and returns null", () => {
    // Build a 7-deep chain of unregistered ids.
    let node: { id: string; parent?: unknown } = { id: "unreg-0" };
    for (let i = 1; i < 8; i++) {
      node = { id: `unreg-${i}`, parent: node };
    }
    expect(resolveRegisteredLid(node as unknown as __esri.Layer, REGISTERED)).toBeNull();
  });
});

describe("resolveTopmost", () => {
  it("returns a null resolution for empty results", () => {
    expect(resolveTopmost([], REGISTERED)).toEqual({
      topLayerId: null,
      topGraphicAttrs: null,
      topGraphic: undefined,
    });
  });

  it("skips non-graphic hits", () => {
    const hits: TapHit[] = [{ type: "media" } as unknown as TapHit];
    expect(resolveTopmost(hits, REGISTERED).topLayerId).toBeNull();
  });

  it("returns the first registered graphic (z-order: front wins)", () => {
    const hits = [
      graphicHit({ id: "fishing-access-sites" }, { NAME: "Lone Pine" }),
      graphicHit({ id: "hunting-districts" }, { DISTRICT: "380" }),
    ];
    const res = resolveTopmost(hits, REGISTERED);
    expect(res.topLayerId).toBe("fishing-access-sites");
    expect(res.topGraphicAttrs).toEqual({ NAME: "Lone Pine" });
    expect(res.topGraphic).toBe(hits[0]);
  });

  it("skips graphics on unregistered layers and walks to the next real hit", () => {
    const hits = [
      graphicHit({ id: "some-cluster-aggregate" }), // not registered
      graphicHit({ id: "hunting-districts" }, { DISTRICT: "380" }),
    ];
    expect(resolveTopmost(hits, REGISTERED).topLayerId).toBe("hunting-districts");
  });

  it("skips infra overlays even when they carry a registered-style id", () => {
    const infraId = [...INFRA_LAYER_IDS][0];
    const registeredWithInfra = new Set<string>([...REGISTERED, infraId]);
    const hits = [
      graphicHit({ id: infraId }),
      graphicHit({ id: "fishing-access-sites" }, { NAME: "Lone Pine" }),
    ];
    expect(resolveTopmost(hits, registeredWithInfra).topLayerId).toBe("fishing-access-sites");
  });

  it("leaves topGraphicAttrs null when the graphic carries no attributes", () => {
    const hits = [graphicHit({ id: "fishing-access-sites" })];
    const res = resolveTopmost(hits, REGISTERED);
    expect(res.topLayerId).toBe("fishing-access-sites");
    expect(res.topGraphicAttrs).toBeNull();
  });
});

describe("collectRegisteredHitLayerIds", () => {
  it("returns the distinct registered ids under the click, front-to-back", () => {
    const hits = [
      graphicHit({ id: "fishing-access-sites" }),
      graphicHit({ id: "hunting-districts" }),
      graphicHit({ id: "fishing-access-sites" }), // dup — collapsed
    ];
    expect(collectRegisteredHitLayerIds(hits, REGISTERED)).toEqual([
      "fishing-access-sites",
      "hunting-districts",
    ]);
  });

  it("excludes infra overlays and unregistered layers", () => {
    const infraId = [...INFRA_LAYER_IDS][0];
    const withInfra = new Set<string>([...REGISTERED, infraId]);
    const hits = [
      graphicHit({ id: infraId }),
      graphicHit({ id: "some-cluster-aggregate" }),
      graphicHit({ id: "hunting-districts" }),
    ];
    expect(collectRegisteredHitLayerIds(hits, withInfra)).toEqual(["hunting-districts"]);
  });

  it("returns empty for no graphic hits", () => {
    expect(collectRegisteredHitLayerIds([], REGISTERED)).toEqual([]);
  });
});

describe("decideClusterZoom", () => {
  const base = {
    hasGeometry: true,
    clusterDisableScale: null as number | null,
    currentScale: 100000,
    currentZoom: 8,
    maxZoom: 18,
  };

  it("zooms in on a real cluster (count >= 2, not past disable, not at max)", () => {
    const d = decideClusterZoom({ ...base, topGraphicAttrs: { cluster_count: 12 } });
    expect(d.shouldZoom).toBe(true);
    expect(d.targetZoom).toBe(10); // min(8 + 2, 18)
    expect(d.clearAttrs).toBe(false);
  });

  it("caps the target zoom at maxZoom", () => {
    const d = decideClusterZoom({
      ...base,
      currentZoom: 17,
      topGraphicAttrs: { cluster_count: 5 },
    });
    // atMaxZoom (17 >= 18 - 1) suppresses the zoom; falls through + clears.
    expect(d.shouldZoom).toBe(false);
    expect(d.clearAttrs).toBe(true);
  });

  it("does not zoom a single-feature false aggregate (count === 1)", () => {
    const d = decideClusterZoom({ ...base, topGraphicAttrs: { cluster_count: 1 } });
    expect(d.shouldZoom).toBe(false);
    // cluster_count is present → clear the synthetic attrs.
    expect(d.clearAttrs).toBe(true);
  });

  it("does not zoom when already past the cluster disable scale", () => {
    const d = decideClusterZoom({
      ...base,
      clusterDisableScale: 150000,
      currentScale: 100000, // <= disable scale → past disable
      topGraphicAttrs: { cluster_count: 9 },
    });
    expect(d.shouldZoom).toBe(false);
    expect(d.clearAttrs).toBe(true);
  });

  it("is a no-op when there is no cluster_count", () => {
    const d = decideClusterZoom({ ...base, topGraphicAttrs: { NAME: "Lone Pine" } });
    expect(d.shouldZoom).toBe(false);
    expect(d.clearAttrs).toBe(false);
  });

  it("does not zoom without a geometry to fly toward", () => {
    const d = decideClusterZoom({
      ...base,
      hasGeometry: false,
      topGraphicAttrs: { cluster_count: 12 },
    });
    expect(d.shouldZoom).toBe(false);
    expect(d.clearAttrs).toBe(true);
  });
});
