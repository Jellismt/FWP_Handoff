/**
 * @file mapViewConstants.ts
 * @module engage-mt/map
 * @description Shared map viewport + tap-query constants. Extracted so the
 *              MapView orchestrator and the tapQuery/* modules read the same
 *              named values instead of duplicating magic numbers across the
 *              decomposition boundary.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-06-29
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** Central Montana — the statewide default viewpoint on first launch. */
export const DEFAULT_CENTER: [number, number] = [-110.3626, 46.8797];
export const DEFAULT_ZOOM = 6;
export const MAX_QUERY_RESULTS_PER_LAYER = 3;
// Zoom 4 ≈ continent overview; zoom 18 ≈ building level. These bounds keep the
// user inside an experience scoped to Montana while still allowing useful detail
// on FAS, BMA boundaries, and parcels.
export const MIN_ZOOM = 4;
export const MAX_ZOOM = 18;
