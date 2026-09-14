/**
 * @file types.ts
 * @module engage-mt/map/featureCards
 * @description Renderer signature for the FeatureCard registry
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { ComponentType, ReactNode } from "react";
import type { EngageMtModule } from "@/types/layers";
import type { TapPoint } from "@/types/featureCard";

// R.1c — `TapPoint` moved to `@/types/featureCard` so non-UI layers (the
// takeover store, intent services) can reference it without depending on
// the components tree. Re-exported here for back-compat with the renderers
// already importing it from this file.
export type { TapPoint };

export interface FeatureRendererProps {
  layerId: string;
  layerTitle: string;
  module: EngageMtModule;
  attrs: Record<string, unknown>;
  /**
   * Optional — present on map-tap-driven renders, absent on programmatic
   * renders (e.g., the takeover portal opened from a search result). Cards
   * that rely on it must defensively skip the enrichment when undefined.
   */
  tapPoint?: TapPoint;
  /**
   * Visual density the card is being rendered at. `"panel"` is the dense
   * right-rail / multi-feature list mode; `"takeover"` is the full-screen
   * modal. Renderers can branch on this to skip heavy bodies (live
   * aggregations, multi-section reports) when they're rendered as one of
   * many siblings inside the TapQueryPanel.
   */
  presentation?: "panel" | "takeover";
}

/** A tab within a multi-section popup body. */
export interface FeatureRendererTab {
  id: string;
  label: string;
  Body: ComponentType<FeatureRendererProps>;
}

export interface FeatureRenderer {
  /** One-line summary shown in the card header. */
  summary: (attrs: Record<string, unknown>) => string;
  /** Body slot — required. */
  Body: ComponentType<FeatureRendererProps>;
  /** Optional action set override. */
  Actions?: ComponentType<FeatureRendererProps>;
  /** Optional route for the "Open detail" action. */
  detailRoute?: (attrs: Record<string, unknown>) => string | null;
  /** Optional secondary subtitle text rendered under the title. */
  subtitle?: (attrs: Record<string, unknown>) => string | undefined;
  /** When true, suppress the header meta-row (layer · subtitle · freshness).
   *  For cards whose provenance strip adds noise rather than signal. */
  hideMeta?: boolean;
  /**
   * When set and it resolves, a tap on this layer navigates straight to the
   * returned route instead of opening a card — the popup would only be a
   * waypoint on the way there. Used by the hunting-district + district-portion
   * polygons, whose whole purpose is "open this district's report".
   */
  tapRoute?: (attrs: Record<string, unknown>) => string | null;
  /** When true, suppress the whole card header (badge + title + meta-row)
   *  on full cards — the body carries its own identity. Compact
   *  multi-feature rows keep the title so stacked lists stay scannable. */
  hideHeader?: boolean;
  /** Optional extra ReactNode to render below the body (e.g. NearbyPublicAccessBlock). */
  Enrichment?: ComponentType<FeatureRendererProps>;
  /**
   * Preferred presentation when the feature is tapped from the map.
   *   - `'panel'` (default): renders in the right-rail TapQueryPanel.
   *   - `'takeover'`: auto-opens the TakeoverPopupPortal full-screen.
   * Users can always escalate a panel card to takeover via the Expand button.
   */
  presentation?: "panel" | "takeover";
  /**
   * Optional tab strip. When present, FeatureCardShell renders a Calcite tab
   * group and routes the active tab's Body component instead of `Body`. The
   * top-level `Body` still acts as a "main" tab if it is provided alongside.
   */
  tabs?: readonly FeatureRendererTab[];
  /**
   * Optional dedicated chart slot. When set, the takeover preset renders it
   * in a hero-sized strip above the body.
   */
  Chart?: ComponentType<FeatureRendererProps>;
  /**
   * When true, multi-feature taps on this layer collapse to a single
   * representative card. Use for renderers whose Body is keyed on the
   * tapPoint (e.g. survey-point spatial aggregation) so identical sibling
   * cards don't stack. The first feature in the group is used as the
   * representative; the count is surfaced in the card subtitle.
   */
  collapseDuplicatesAtTap?: boolean;
}

export type AttrLookup = (...keys: readonly string[]) => unknown;

/** Look up the first present, non-empty attribute among the given keys. */
export const pick =
  (attrs: Record<string, unknown>): AttrLookup =>
  (...keys: readonly string[]) => {
    for (const k of keys) {
      const v = attrs[k];
      if (v !== null && v !== undefined && v !== "") return v;
    }
    return undefined;
  };

/** Defensive number parser. Returns null when not a finite number. */
export const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

/** Defensive string parser. Returns null for empty / missing. */
export const str = (v: unknown): string | null => {
  if (typeof v !== "string") return v === null || v === undefined ? null : String(v);
  return v.length > 0 ? v : null;
};

/**
 * Title-case a value that the upstream service ships in ALL CAPS (e.g. the BLM
 * rec-site DESCRIPTIO field = "MISSOURI HEADWATERS"). Capitalizes the first
 * letter of each whitespace-delimited word.
 */
export const titleCase = (v: string): string =>
  v.toLowerCase().replace(/(^|\s)([a-z])/g, (_m, sp, ch) => sp + ch.toUpperCase());

export type FeatureRendererChildrenSlot = ReactNode;
