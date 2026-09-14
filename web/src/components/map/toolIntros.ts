/**
 * @file toolIntros.ts
 * @module engage-mt/map
 * @description The intro-copy registry for map-first tools.
 *              Split from ToolIntroExplainer.tsx so the component file exports
 *              only a component (react-refresh boundary). Adding a map-first
 *              tool = one entry here + an `&intro=<toolId>` on its card link.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-06
 * @updated 2026-07-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { EngageMtModule } from "@/types/layers";

export interface ToolIntro {
  module: EngageMtModule;
  title: string;
  body: string;
  /** Optional link to the tool's full (non-map) explorer surface. */
  cta?: { label: string; to: string };
}

/** Keyed by the `intro=<toolId>` query param. Keep bodies to 1–2 sentences. */
export const TOOL_INTROS: Record<string, ToolIntro> = {
  fas: {
    module: "fish",
    title: "Fishing Access Sites",
    body: "Every FWP fishing access site in Montana is on the map. Pan around and tap a site to see its facilities, boat ramp, camping, and regulations.",
  },
  "state-parks": {
    module: "explore",
    title: "State Parks",
    body: "Montana's state parks are shown on the map. Tap a park for camping, activities, fees, and a link to its official page.",
  },
  wmas: {
    module: "explore",
    title: "Wildlife Management Areas",
    body: "FWP Wildlife Management Areas are on the map. Tap one for its access rules, seasons, and any special restrictions before you go.",
  },
  bma: {
    module: "access",
    title: "Block Management Areas",
    body: "Block Management Areas are private lands enrolled with FWP for public hunting. Tap a BMA for its type, sign-in rules, and contact info.",
  },
  ownership: {
    module: "access",
    title: "Public / Private Ownership",
    body: "The map shows land ownership — public agencies and private parcels. Tap anywhere to see who owns that ground, the acreage, and its access status.",
  },
  trails: {
    module: "explore",
    title: "Trails",
    body: "Montana's trails — USFS, national parks, and county systems — are on the map. Tap a trail to see whatever details the source publishes for it.",
  },
};
