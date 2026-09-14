/**
 * @file index.ts
 * @module engage-mt/shared
 * @description Barrel for @engage-mt/regs-shared — the one cohesive types package
 *              shared by server + staff (and the web contract test). Barrel is
 *              sanctioned here per design-polish § "self-contained widget folders".
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-05
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export * from "./normalizedRegulation.js";
export * from "./domain.js";
export * from "./api.js";
export * from "./staffSchemas.js";
export * from "./arcgisLayers.js";
