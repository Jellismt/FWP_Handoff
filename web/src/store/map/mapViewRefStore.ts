/**
 * @file mapViewRefStore.ts
 * @module engage-mt/store
 * @description R.4a — Co-located with `useMapModeStore` in `./mapStore`. See
 *              `./mapStore.ts` for the rationale. This file re-exports the
 *              original public surface so existing imports keep working.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-05
 * @updated 2026-07-03
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export { useMapViewRefStore, type ActiveView } from "@/store/map/mapStore";
