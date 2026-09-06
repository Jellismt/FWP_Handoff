/**
 * @file prefetch.ts
 * @module engage-mt/routes
 * @description The route chunks worth warming before the user commits to a
 *              navigation. Tab and in-page links call `prefetchRoute(path)`
 *              on hover/focus (see `utils/routePrefetch`), so the lazy chunk
 *              for the destination is already in flight when the click lands.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { registerPrefetch } from "@/utils/routePrefetch";

type ImportFactory = () => Promise<unknown>;

/** Path → lazy chunk loader, one row per primary destination. */
export const PREFETCH_ROUTES: ReadonlyArray<readonly [string, ImportFactory]> = [
  ["/hunt", () => import("@/components/hunt/HuntPage")],
  ["/hunt/districts", () => import("@/components/hunt/HuntingDistrictsBrowser")],
  ["/explore", () => import("@/components/explore/ExploreAccessPage")],
  ["/manage", () => import("@/components/manage/ManagePage")],
  ["/manage/offline-tiles", () => import("@/components/manage/OfflineTilesPage")],
  ["/field", () => import("@/components/field/FieldToolsPage")],
];

/** Register every prefetchable route once at app start. */
export function registerPrefetchRoutes(): void {
  for (const [path, factory] of PREFETCH_ROUTES) registerPrefetch(path, factory);
}
