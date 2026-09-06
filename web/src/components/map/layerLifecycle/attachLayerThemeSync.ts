/**
 * @file attachLayerThemeSync.ts
 * @module engage-mt/map
 * @description Dark-mode symbology recolor subscription extracted from
 *              MapView.tsx. On every theme flip, re-applies
 *              each operational layer's renderer (getRenderer re-reads the CSS
 *              custom properties at call-time so accents + alpha track dark
 *              mode) and re-applies the USGS gages GraphicsLayer's per-graphic
 *              gauge marker. Returns the store unsubscribe — same imperative
 *              detach pattern as the other map attachers. The Montana mask owns
 *              its own theme subscription (see montanaBoundaryMask.ts).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type Layer from "@arcgis/core/layers/Layer";
import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import { LAYER_REGISTRY } from "@/config/layers";
import { useThemeStore } from "@/store/app/themeStore";
import { getRenderer } from "../symbology";
import { applyUsgsGageTheme } from "../usgsGagesLayer";

export interface AttachLayerThemeSyncParams {
  /** The shared id → Layer index owned by `attachRegistryLayers`. */
  layerIndex: Map<string, Layer>;
}

/**
 * Subscribe to theme changes and recolor every registry layer + the USGS gages
 * GraphicsLayer. Returns the unsubscribe.
 */
export function attachLayerThemeSync({ layerIndex }: AttachLayerThemeSyncParams): () => void {
  return useThemeStore.subscribe((state) => {
    for (const def of LAYER_REGISTRY) {
      if (def.deferredLoad) continue;
      const layer = layerIndex.get(def.id);
      if (!layer) continue;
      const renderer = getRenderer(def);
      if (renderer) {
        (layer as unknown as { renderer: unknown }).renderer = renderer;
      }
    }
    // USGS gages is a GraphicsLayer (per-graphic symbol, not a FeatureLayer
    // renderer), so it's outside the loop above — walk its graphics directly.
    const usgs = layerIndex.get("usgs-gages");
    if (usgs) {
      applyUsgsGageTheme(usgs as GraphicsLayer, state.resolved);
    }
  });
}
