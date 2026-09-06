/**
 * @file registry.test.ts
 * @module engage-mt/map/featureCards
 * @description Verifies the FeatureCard registry registers/resolves correctly and that
 *              the high-traffic layer ids have Tier-2 renderers wired through index.ts.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
// Side-effect import to register every Tier-2 renderer
import "../index";
import { resolveFeature, registeredLayerIds } from "@/components/map/featureCards/core/registry";

describe("FeatureCard registry", () => {
  it("registers the high-traffic layer renderers", () => {
    const ids = registeredLayerIds();
    for (const required of [
      "bma-boundaries",
      "fishing-access-sites",
      "hunting-districts",
      "usgs-gages",
      "dnrc-stage-gages",
      "active-fires-points",
      "wildlife-management-areas",
      "state-parks",
      "ais-inspection-stations",
      "mt-cadastral",
      "weather-stations",
      "wind-stations",
      "fwp-access-program",
      "conservation-layers",
      "msl-roads",
      "admin-boundaries",
    ]) {
      expect(ids).toContain(required);
    }
  });

  it("returns null for an unknown layer id", () => {
    expect(resolveFeature("does-not-exist")).toBeNull();
  });

  it("produces a non-empty summary from an empty attrs object", () => {
    const r = resolveFeature("bma-boundaries");
    expect(r).not.toBeNull();
    if (!r) return;
    const summary = r.summary({});
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("emits a detail route for BMA when an id is present", () => {
    const r = resolveFeature("bma-boundaries");
    expect(r?.detailRoute?.({ BMA_ID: "abc-123" })).toBe("/access/bma/abc-123");
  });

  it("emits a detail route for WMA when OBJECTID is present", () => {
    const r = resolveFeature("wildlife-management-areas");
    expect(r?.detailRoute?.({ OBJECTID: 42 })).toBe("/explore/wma/42");
  });

  it("emits a detail route for State Park when OBJECTID is present", () => {
    const r = resolveFeature("state-parks");
    expect(r?.detailRoute?.({ OBJECTID: 7 })).toBe("/explore/park/7");
  });
});
