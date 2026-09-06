/**
 * @file index.ts
 * @module engage-mt/shared
 * @description Barrel for the TipMont popup feature. Exposes only the portal
 *              (the single public entry point). The form + warden panel are NOT
 *              re-exported: they're lazy-loaded inside the portal, and a static
 *              barrel re-export would pin them into the entry chunk and negate
 * That code-split.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export { TipMontPortal } from "./TipMontPortal";
