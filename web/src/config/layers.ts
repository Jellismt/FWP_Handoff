/**
 * @file layers.ts
 * @module engage-mt/config
 * @description Layer registry — single source of truth for every map layer in the app.
 *              Components reference layers by id; never inline URLs in components.
 *              Each layer is owned by one module; cross-cutting overlays are
 *              tagged "shared".
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { LayerDef } from "@/types/layers";
import { HUNT_LAYERS } from "./layers/hunt";
import { FISH_LAYERS } from "./layers/fish";
import { EXPLORE_LAYERS } from "./layers/explore";
import { ACCESS_LAYERS } from "./layers/access";
import { SHARED_LAYERS } from "./layers/shared";

/**
 * Public layer set. URLs verified against the upstream FWP/partner services.
 * Four layers are default-visible at first launch, all in the Conditions and
 * Reference groups: active fires, wind stations, NOAA radar, and public-land
 * ownership.
 *
 * The registry is composed from one file per module under `config/layers/`;
 * consumers import only this file (`LAYER_REGISTRY` is one flat readonly array).
 *
 * Panel grouping order is owned by `MODULE_ORDER` in
 * `components/map/LayerPanel.tsx`, not by this file. The spread order below
 * only decides how layers sort within a group.
 */

/**
 * Flat composition of the five per-module sub-arrays declared above. A layer's
 * `module` is what places it in the panel, so `reference` layers live in
 * whichever sub-array is convenient rather than in one of their own (see
 * docs/rules/ia.md).
 */
export const LAYER_REGISTRY: readonly LayerDef[] = [
  ...HUNT_LAYERS,
  ...FISH_LAYERS,
  ...EXPLORE_LAYERS,
  ...ACCESS_LAYERS,
  ...SHARED_LAYERS,
];

/** Lookup a layer definition by id. Used by TapQueryPanel + detail panels. */
export const findLayerById = (id: string): LayerDef | undefined =>
  LAYER_REGISTRY.find((layer) => layer.id === id);

/** Layers grouped by module — drives the layer-panel sections. */
export const layersByModule = (module: LayerDef["module"]): LayerDef[] =>
  LAYER_REGISTRY.filter((l) => l.module === module);

/**
 * Resolve a feature service URL by registered layer id. Throws if the id is
 * unknown — registry-backed call sites should crash loudly during dev rather
 * than silently fall through to "service unreachable" UX at runtime.
 *
 * Used by enrichment blocks + spatial-context lookups that need the URL
 * without instantiating the layer on the map. Per the registry-compliance
 * rule in docs/rules/arcgis.md: feature services live in this file, not
 * inlined at call sites.
 */
export const getLayerUrl = (id: string): string => {
  const layer = findLayerById(id);
  if (!layer) {
    throw new Error(`getLayerUrl: unknown layer id "${id}". Check src/config/layers.ts.`);
  }
  return layer.url;
};
