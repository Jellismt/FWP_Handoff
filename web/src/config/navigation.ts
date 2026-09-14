/**
 * @file navigation.ts
 * @module engage-mt/config
 * @description Module navigation entries shared by Sidebar and BottomTabBar.
 *              3 tabs: Hunt / Explore & Access / My FWP.
 *              Explore + Access present as ONE tab; both module ids stay
 *              first-class internally (layers, accents, routes). Fish is folded
 *              into Explore & Access — it survives as an internal module id
 *              (accent, routes, altPathPrefixes), not as its own tab.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-15
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { EngageMtModule } from "@/types/layers";

export interface ModuleNavEntry {
  module: EngageMtModule;
  label: string;
  path: string;
  /** Single-character emoji glyph for now; replaced with FWP iconography later. */
  glyph: string;
  /** Headline question this module answers — used as the SR-only summary. */
  question: string;
  /**
   * Extra route prefixes that should light this tab as active. Used by the
   * merged "Explore & Access" tab so /access/* routes still highlight it.
   */
  altPathPrefixes?: readonly string[];
}

export const MODULE_NAV: readonly ModuleNavEntry[] = [
  {
    module: "hunt",
    label: "Hunt",
    path: "/hunt",
    glyph: "target",
    question: "Where can I hunt?",
  },
  {
    // Explore + Access (and the fishing-access
    // entry point) share one tab. The internal module ids ("explore",
    // "access", "fish") all survive: layers keep their canonical owner +
    // accent, and the pre-merge tab paths keep working (they light this
    // tab via altPathPrefixes).
    module: "explore",
    label: "Explore & Access",
    path: "/explore",
    glyph: "tree-pine",
    question: "Where can I go — and can I legally be there?",
    altPathPrefixes: ["/access", "/fish"],
  },
  {
    // Presented as "My FWP"; the internal module id +
    // /manage route are unchanged so deep links and store keys keep working.
    module: "manage",
    label: "My FWP",
    path: "/manage",
    glyph: "id-card",
    question: "What do I own, owe, and need to do?",
  },
];

/**
 * Map a module to its accent CSS custom property.
 *
 * Accent palette per FWP brand spec sheet (source of truth: brand-tokens.css,
 * Revised — see docs/rules/fwp-brand.md):
 *   Hunt    → FWP Red      (#B3252E)
 *   Fish    → FWP Blue     (#002855)
 *   Explore → Brown        (#744F28)
 *   Access  → FWP Green    (#046A38; flips to yellow-gold on dark)
 *   Manage  → Graphite     (#2D3748)
 * The primary CTA + focus ring is FWP Yellow (#FFC72C), not a module accent.
 */
export const MODULE_ACCENT_VAR: Record<EngageMtModule, string> = {
  hunt: "var(--fwp-accent-hunt)",
  fish: "var(--fwp-accent-fish)",
  explore: "var(--fwp-accent-explore)",
  access: "var(--fwp-accent-access)",
  manage: "var(--fwp-accent-manage)",
  // Shared/Conditions popups (field items, wind, wildfires)
  // wear the theme yellow, not the hunt red.
  shared: "var(--fwp-yellow)",
  // Reference (radar/wind/VTL) reads as cross-cutting blue.
  reference: "var(--fwp-blue)",
};
