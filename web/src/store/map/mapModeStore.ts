/**
 * @file mapModeStore.ts
 * @module engage-mt/store
 * @description R.4a — Co-located with `useMapViewRefStore` in `./mapStore`.
 *              This file re-exports the original public surface so the dozens
 *              of consumer imports keep working unchanged. New code may import
 *              from `@/store/mapStore` directly.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export { useMapModeStore, type BasemapKey, type MapViewpoint } from "@/store/map/mapStore";
