/**
 * @file layerSources.ts
 * @module engage-mt/config
 * @description Map layers grouped by the source they are drawn from, for the
 *              Attribution page. Composite layers own no data and are left out.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { LAYER_REGISTRY } from "./layers";

export interface LayerSourceGroup {
  sourceLabel: string;
  upstreamUrl?: string;
  layers: string[];
}

export const layerSourceGroups = (): LayerSourceGroup[] => {
  const groups = new Map<string, LayerSourceGroup>();
  for (const def of LAYER_REGISTRY) {
    if (def.composite) continue;
    const group = groups.get(def.sourceLabel) ?? {
      sourceLabel: def.sourceLabel,
      upstreamUrl: def.upstreamUrl,
      layers: [],
    };
    group.layers.push(def.title);
    groups.set(def.sourceLabel, group);
  }
  return [...groups.values()].sort((a, b) => a.sourceLabel.localeCompare(b.sourceLabel));
};
