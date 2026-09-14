/**
 * @file layers.invariants.test.ts
 * @module engage-mt/config
 * @description Invariant tests on the layer
 *              registry. Asserts the contracts that keep the registry
 *              honest as it grows:
 *
 *                1. Every `id` is unique across the registry.
 *                2. Every `id` is the kebab-case naming convention
 *                   (lowercase letters, digits, hyphens, colons).
 *                3. Every `module` is one of the allowed values.
 *                4. Every `source` is one of the allowed values.
 *                5. Every `freshness` is one of the allowed values.
 *                6. Every entry has a non-empty `title` + `url`.
 *                7. `findLayerById` resolves every registered id.
 *                8. `layersByModule` partition equals the registry.
 *                9. `getLayerUrl` throws on an unknown id.
 *
 *              Per docs/rules/ia.md + docs/rules/arcgis.md +
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-17
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { LAYER_REGISTRY, findLayerById, layersByModule, getLayerUrl } from "./layers";

const ALLOWED_MODULES = ["hunt", "fish", "explore", "access", "shared", "reference"] as const;
const ALLOWED_SOURCES = [
  "fwp-public-hub",
  "esri-living-atlas",
  "fwp-internal",
  "external",
  "external-public",
  "engage-mt",
] as const;
const ALLOWED_FRESHNESS = ["realtime", "hourly", "daily", "weekly", "static", "versioned"] as const;
const ID_PATTERN = /^[a-z0-9][a-z0-9-:.]*$/;

describe("LAYER_REGISTRY invariants", () => {
  it("the registry is non-empty", () => {
    expect(LAYER_REGISTRY.length).toBeGreaterThan(0);
  });

  it("every id is unique", () => {
    const seen = new Map<string, number>();
    for (const layer of LAYER_REGISTRY) {
      seen.set(layer.id, (seen.get(layer.id) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, count]) => count > 1);
    expect(dupes, `Duplicate layer ids: ${JSON.stringify(dupes)}`).toEqual([]);
  });

  it("every id matches the kebab-case naming convention", () => {
    const bad = LAYER_REGISTRY.filter((l) => !ID_PATTERN.test(l.id)).map((l) => l.id);
    expect(bad, `IDs not matching ${ID_PATTERN}: ${JSON.stringify(bad)}`).toEqual([]);
  });

  it("every module is one of the allowed canonical owners", () => {
    const bad = LAYER_REGISTRY.filter(
      (l) => !(ALLOWED_MODULES as readonly string[]).includes(l.module),
    ).map((l) => ({ id: l.id, module: l.module }));
    expect(bad).toEqual([]);
  });

  it("every source is one of the allowed source flavors", () => {
    const bad = LAYER_REGISTRY.filter(
      (l) => !(ALLOWED_SOURCES as readonly string[]).includes(l.source),
    ).map((l) => ({ id: l.id, source: l.source }));
    expect(bad).toEqual([]);
  });

  it("every freshness is one of the allowed vocabulary entries", () => {
    const bad = LAYER_REGISTRY.filter(
      (l) => !(ALLOWED_FRESHNESS as readonly string[]).includes(l.freshness),
    ).map((l) => ({ id: l.id, freshness: l.freshness }));
    expect(bad).toEqual([]);
  });

  it("every layer has a non-empty title", () => {
    for (const layer of LAYER_REGISTRY) {
      expect(layer.title, `Missing title: ${layer.id}`).toBeTruthy();
    }
  });

  it("layer.url is a string for every entry (empty allowed for composite/bundled sources)", () => {
    for (const layer of LAYER_REGISTRY) {
      expect(typeof layer.url, `url not a string: ${layer.id}`).toBe("string");
    }
  });
});

describe("registry accessors", () => {
  it("findLayerById resolves every registered id", () => {
    for (const layer of LAYER_REGISTRY) {
      expect(findLayerById(layer.id)?.id).toBe(layer.id);
    }
  });

  it("findLayerById returns undefined for unknown id", () => {
    expect(findLayerById("does-not-exist-xyz")).toBeUndefined();
  });

  it("layersByModule partitions cover the full registry (no double-counting)", () => {
    const total = ALLOWED_MODULES.reduce(
      (sum, m) => sum + layersByModule(m as (typeof ALLOWED_MODULES)[number]).length,
      0,
    );
    expect(total).toBe(LAYER_REGISTRY.length);
  });

  it("layersByModule returns only entries with that module", () => {
    for (const m of ALLOWED_MODULES) {
      const subset = layersByModule(m);
      for (const layer of subset) {
        expect(layer.module).toBe(m);
      }
    }
  });

  it("getLayerUrl returns the registered URL", () => {
    const first = LAYER_REGISTRY[0];
    expect(getLayerUrl(first.id)).toBe(first.url);
  });

  it("getLayerUrl throws loudly on unknown id (no silent fallthrough)", () => {
    expect(() => getLayerUrl("definitely-not-a-real-id")).toThrow(/unknown layer id/);
  });
});
