/**
 * @file featureCard.ts
 * @module engage-mt/types
 * @description R.1c — Shared types that components and non-UI layers both
 *              read. Lifted out of `components/map/featureCards/types.ts` so
 *              `services/intent/canIFishHere.ts` + `store/takeoverPopupStore.ts`
 *              can reference them without importing from the components/ tree
 *.
 *
 *              `TapPoint` lives here because it's a pure data structure
 *              describing a click coordinate — no React, no ArcGIS runtime.
 *              The richer `FeatureRendererProps` / `FeatureRenderer` /
 *              `FeatureRendererTab` interfaces stay next to the registry
 *              because they reference React component types.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-10
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/**
 * Map-point coordinates captured at click time, threaded to renderers so
 * cross-layer enrichment blocks (e.g. NearbyPublicAccessBlock) can derive
 * nearby context from the tapped location. (the
 * tap-query land-tenure plan). The point is
 * always in the view's spatial reference (Web Mercator wkid 102100 for
 * Engage MT's basemap); `latitude` + `longitude` are conveniences taken
 * from the same ArcGIS Point.
 */
export interface TapPoint {
  x: number;
  y: number;
  latitude: number;
  longitude: number;
  spatialReferenceWkid?: number;
}
