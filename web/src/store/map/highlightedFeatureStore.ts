/**
 * @file highlightedFeatureStore.ts
 * @module engage-mt/store
 * @description R.4c — Co-located with `useTakeoverPopupStore` in
 *              `./featureFocusStore`. This file re-exports the original
 *              public surface so existing imports keep working unchanged.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export {
  useHighlightedFeatureStore,
  type HighlightKind,
  type HighlightTarget,
  type HighlightGeometry,
} from "@/store/map/featureFocusStore";
