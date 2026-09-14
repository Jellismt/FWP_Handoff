/**
 * @file registry.ts
 * @module engage-mt/map/featureCards
 * @description The FeatureCard registry. Tier-2 renderers register themselves at module
 *              load time; consumers resolve by layer id and fall back to Tier-1 Generic.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 *
 * RULES (enforced at PR review docs/rules/feature-cards.md):
 *
 *   1. Every Tier-2 renderer's `Body` MUST lead with exactly one of:
 *      - `<HeroBlock />`  — numeric headline (acres, cfs, °F, count). Default.
 *      - `<MetricCallout />` — categorical headline where intent carries the cue.
 *      A renderer that lacks both is not yet Tier 2; promote it or leave Tier 1.
 *
 *   2. Slot order in the Body is fixed (skip slots, never reorder):
 *      Hero → MetricGrid → ChipRow → Paragraph → Chart → TipBlock → Enrichment.
 *
 *   3. File budget is ~200 lines per renderer. Past that, extract shared logic
 *      into `_shared.tsx` / `cardPrimitives.tsx` or promote to a Tier-3 detail
 *      page.
 *
 *   4. Renderers must tolerate partial attribute data: defensively narrow
 *      `Record<string, unknown>` at the top and drop pills/sections that
 *      lack their required attrs rather than rendering "undefined".
 */

import type { FeatureRenderer } from "@/components/map/featureCards/core/types";

const registry = new Map<string, FeatureRenderer>();

export const registerFeature = (layerId: string, renderer: FeatureRenderer): void => {
  registry.set(layerId, renderer);
};

export const resolveFeature = (layerId: string): FeatureRenderer | null =>
  registry.get(layerId) ?? null;

export const registeredLayerIds = (): readonly string[] => Array.from(registry.keys());
