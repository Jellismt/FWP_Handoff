/**
 * @file layers.attribution.test.ts
 * @module engage-mt/config
 * @description Remediation. Static contract test
 *              for the LAYER_REGISTRY: every layer must declare an
 *              attribution-bearing `sourceLabel` so the feature card +
 *              about page can credit the source. `upstreamUrl` is
 *              required on every non-internal layer so users can
 *              deep-link to the authoritative source.
 *
 *              Catches a class of regressions where a new layer is
 *              copy-pasted in and ships without credit — failing the
 *              FWP brand promise of cited, official data.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { LAYER_REGISTRY } from "./layers";

describe("LAYER_REGISTRY attribution", () => {
  it("every layer declares a non-empty sourceLabel", () => {
    for (const def of LAYER_REGISTRY) {
      expect(typeof def.sourceLabel, `layer "${def.id}" sourceLabel must be a string`).toBe(
        "string",
      );
      expect(
        def.sourceLabel.trim().length,
        `layer "${def.id}" sourceLabel is empty`,
      ).toBeGreaterThan(0);
    }
  });

  it("every layer declares a freshness category", () => {
    const validFreshness = new Set([
      "realtime",
      "hourly",
      "daily",
      "weekly",
      "static",
      "versioned",
    ]);
    for (const def of LAYER_REGISTRY) {
      expect(
        validFreshness.has(def.freshness),
        `layer "${def.id}" freshness "${def.freshness}" not in the canonical vocabulary`,
      ).toBe(true);
    }
  });

  it("every non-composite, non-fixture layer has an upstreamUrl", () => {
    for (const def of LAYER_REGISTRY) {
      if (def.composite) continue;
      // Static-JSON fixtures live under /data/ — they don't have a remote URL.
      if (!def.url || !/^https?:\/\//.test(def.url)) continue;
      expect(
        def.upstreamUrl,
        `layer "${def.id}" needs an upstreamUrl so users can open the authoritative source`,
      ).toBeDefined();
      expect(
        def.upstreamUrl!.startsWith("http"),
        `layer "${def.id}" upstreamUrl must be an absolute http(s) URL`,
      ).toBe(true);
    }
  });

  it("layer ids are unique", () => {
    const seen = new Set<string>();
    for (const def of LAYER_REGISTRY) {
      expect(seen.has(def.id), `duplicate layer id "${def.id}"`).toBe(false);
      seen.add(def.id);
    }
  });
});
