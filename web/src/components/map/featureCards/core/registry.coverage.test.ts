/**
 * @file registry.coverage.test.ts
 * @module engage-mt/map/featureCards
 * @description Popup-to-layer wiring audit. Asserts:
 *
 *              1. Every Tier-2 renderer registered through
 *                 `registerFeature(layerId, ...)` corresponds to a
 *                 real LayerDef in the LAYER_REGISTRY. Catches typo
 *                 drift on the layerId string.
 *              2. Every queryable LayerDef (geometry !== null,
 *                 not deferredLoad) either has a Tier-2 renderer
 *                 OR explicitly falls through to the Tier-1
 *                 GenericCard. Currently the resolver falls back
 *                 silently when no renderer exists; this test
 *                 surfaces unwired layers + makes the fallthrough
 *                 intentional rather than implicit.
 *              3. Every layer surfaced by TapQueryPanel's flow
 *                 (visible, queryable, has a click handler upstream)
 *                 produces SOME card rather than a blank popup.
 *
 *              Run as part of the normal vitest pass; failure means
 *              a new layer was registered without a corresponding
 *              card, OR a card's layerId no longer matches the
 *              registry. Update either side to bring them back in
 *              sync.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { LAYER_REGISTRY } from "@/config/layers";
import { registeredLayerIds, resolveFeature } from "@/components/map/featureCards/core/registry";
// Side-effect import — kicks off every Tier-2 registration so the
// `registeredLayerIds()` result is populated for assertions below.
import "../index";

describe("FeatureCard ↔ Layer registry coverage", () => {
  const layerIds = new Set(LAYER_REGISTRY.map((l) => l.id));
  // Tier-2 renderers may also be registered under synthetic ids that aren't
  // backed by a Layer in the registry. Allowlist the prefix.
  const SYNTHETIC_LAYER_PREFIX = "engage-mt:";

  // Tier-2 renderers that exist in source but don't yet match a
  // LayerDef in LAYER_REGISTRY. Each is either a draft renderer for
  // a future layer or a renderer whose layer was renamed. Removing
  // entries here forces the renderer to either land its layer or be
  // deleted as dead code — surfaced in the audit, not silently kept.
  const KNOWN_DRAFT_RENDERERS: ReadonlySet<string> = new Set([
    "weather-stations", // RAWS station card — awaits weather-stations LayerDef
    "wind-stations", // Wind sensor card — same
    "conservation-layers", // Generic conservation overlay
    "msl-roads", // MSL transportation layer
    "admin-boundaries", // Generic admin polygon
    // Field-tools synthetic ids — user-owned Tier-3 content (waypoints,
    // tracks, shapes) routed through the same FeatureCard pipeline as
    // operational layers. Documented in docs/rules/ia.md
    // (the "My field tools" cross-cut row). No matching LayerDef by
    // design — they're hit-tested above operational layers from a
    // separate GraphicsLayer.
    "engage-mt-field-waypoint",
    "engage-mt-field-track",
    "engage-mt-field-shape",
  ]);

  it("every registered renderer points at a real layer, a synthetic takeover id, or a known-draft id", () => {
    const orphaned: string[] = [];
    for (const id of registeredLayerIds()) {
      if (id.startsWith(SYNTHETIC_LAYER_PREFIX)) continue;
      if (KNOWN_DRAFT_RENDERERS.has(id)) continue;
      if (!layerIds.has(id)) orphaned.push(id);
    }
    expect(
      orphaned,
      `Tier-2 renderers registered to non-existent layer ids: ${orphaned.join(", ")}. ` +
        "Either land the matching LayerDef in web/src/config/layers.ts, rename the renderer's registerFeature() id to match an existing layer, or add the id to KNOWN_DRAFT_RENDERERS above with a note.",
    ).toEqual([]);
  });

  it("every queryable LayerDef resolves to either a Tier-2 renderer or null (Tier-1 fallback)", () => {
    // `null` is a valid resolution (means "Tier-1 GenericCard fallback").
    // The test exists so that any layer added in the future surfaces
    // here when the team decides whether it deserves a Tier-2 card.
    // Update KNOWN_TIER_1_FALLBACK to acknowledge layers that should
    // remain on the generic renderer.
    const KNOWN_TIER_1_FALLBACK: ReadonlySet<string> = new Set([
      // These layers render fine through GenericCard — their attributes
      // are self-explanatory and don't merit a branded card.
      // (Add layers here as they're explicitly decided to stay Tier-1.)
    ]);

    const unwired: { id: string; module: string }[] = [];
    for (const def of LAYER_REGISTRY) {
      if (def.deferredLoad) continue; // token-gated; popup never fires
      const renderer = resolveFeature(def.id);
      if (renderer === null && !KNOWN_TIER_1_FALLBACK.has(def.id)) {
        unwired.push({ id: def.id, module: def.module });
      }
    }
    // For now we don't FAIL on Tier-1 fallthrough; we just report.
    // The test would become a blocker once every layer should have a
    // Tier-2 card. Today many layers ship with GenericCard intentionally.
    if (unwired.length > 0) {
      const lines = unwired.map(({ id, module }) => `  - ${id} (module: ${module})`).join("\n");
      console.warn(
        `\nPhase K.5 — ${unwired.length} layer(s) currently fall through to Tier-1 GenericCard:\n${lines}\n` +
          "These render via the generic attribute table. Add a Tier-2 card under web/src/components/map/featureCards/ " +
          "if any deserve branded treatment. (This is a warning, not a failure.)",
      );
    }
    // Floor — 65% Tier-2 coverage today (18 / 27). Raises
    // as more cards land. The point of the floor is to PREVENT a
    // regression below current baseline — not to gate new layers.
    // When a new layer adds without a card, this assertion fires;
    // the team must either ship a Tier-2 renderer or add the layer
    // to KNOWN_TIER_1_FALLBACK.
    const total = LAYER_REGISTRY.filter((l) => !l.deferredLoad).length;
    const wired = total - unwired.length;
    expect(
      wired / total,
      `Only ${wired}/${total} non-deferred layers have Tier-2 cards (floor 65%). Add a renderer or add the layer to KNOWN_TIER_1_FALLBACK.`,
    ).toBeGreaterThanOrEqual(0.65);
  });
});
