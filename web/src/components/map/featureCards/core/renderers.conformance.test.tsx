/**
 * @file renderers.conformance.test.tsx
 * @module engage-mt/map/featureCards
 * @description Hero-conformance enforcement. Asserts that every
 *              registered Tier-2 renderer's Body leads with exactly one
 *              of the canonical "hero" primitives — HeroBlock, HeroPair,
 *              HeroValue, or MetricCallout. The rule is documented in
 *              docs/rules/feature-cards.md and docs/adrs/0022-popup-
 *              polish-vocabulary.md but, until this file, was not
 *              enforced by the test suite. Without enforcement a
 *              future refactor can quietly downgrade a Tier-2 card
 *              back to an attribute table.
 *
 *              Exemptions are documented inline in HERO_EXEMPT, each
 *              with the reason the rule does not apply. The default
 *              answer for a renderer that fails this test is "compose
 *              a HeroBlock at the top of the Body" — exempting should
 *              be a deliberate, justified choice (intentionally minimal
 *              panel, takeover-only composition that owns its own
 *              hierarchy, or a custom visual hero that replaces the
 *              numeric one).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-14
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
// Side-effect import — registers every Tier-2 renderer.
import "../index";
import { registeredLayerIds, resolveFeature } from "@/components/map/featureCards/core/registry";
import { FIXTURE_ATTRS, fixtureProps } from "@/test/fixtures";

/**
 * Hero selectors. Each Tier-2 renderer's first significant Body node
 * must match at least one of these. They map 1:1 to the primitives
 * exported from cardPrimitives.tsx:
 *
 *   .fwp-hero-block   ← HeroBlock
 *   .fwp-hero-pair    ← HeroPair (renders two HeroBlocks side-by-side)
 *   .fwp-hero-value   ← HeroValue (legacy, still emitted by HeroBlock)
 *   .fwp-metric-callout ← MetricCallout
 */
const HERO_SELECTOR = [
  ".fwp-hero-block",
  ".fwp-hero-pair",
  ".fwp-hero-value",
  ".fwp-metric-callout",
].join(", ");

/**
 * Renderers exempted from the hero rule. Each entry carries the reason
 * so a future reviewer can challenge the exemption rather than treat it
 * as gospel. To remove an exemption: delete the line + add a HeroBlock
 * (or MetricCallout) to the renderer's Body.
 */
const HERO_EXEMPT: ReadonlyMap<string, string> = new Map([
  // ── Minimal panel previews ────────────────────────────────────────
  // Designed as the "minimal styled popup" answer for hover-tier NHD
  // streams. Header chip carries the weight; a numeric hero would be
  // invented from thin attrs (no count to render).

  // ── WindStationCard ───────────────────────────────────────────────
  // Custom layout — replaces the numeric hero with a compass-rose SVG
  // that points the way the wind is going + a Beaufort tier badge.
  // The visual hero IS the compass, not a HeroBlock. Documented in
  // the renderer's file header. Registered under both the
  // panel id and a synthetic takeover id; exempt both.
  ["wind-stations", "WindStationCard — compass-rose SVG IS the hero"],
  ["engage-mt:wind-stations", "WindStationCard — compass-rose SVG IS the hero"],

  // ── WaterbodyClosureCard ──────────────────────────────────────────
  // The MetricCallout hero restated the waterbody + restriction
  // title, which the card title now carries ("Gallatin River — Hoot Owl …").
  // The body is the restriction's details, so there is no number to hero.
  ["waterbody-closures", "Waterbody + restriction title IS the hero (card title)"],

  // ── ActiveFireCard ────────────────────────────────────────────────
  // Burned area moved from a raised HeroBlock to a flat MetricPill
  // so it matches the Discovered / Cause pills (per design). No numeric hero.
  ["active-fires-points", "Burned area is a flat MetricPill, not a raised hero"],

  // ── Async-data-gated heroes ───────────────────────────────────────
  // The hero renders only after the live (USGS NWIS / DNRC StAGE) fetch
  // resolves; in a unit-test environment the Body shows the loading TipBlock.
  ["usgs-gages", "Hero is gated on useUsgsLatest — unit env returns loading"],
  ["dnrc-stage-gages", "Hero is gated on useDnrcStage — unit env returns loading"],

  // ── Field-tools (user-owned content) ──────────────────────────────
  // WaypointCard / TrackCard / ShapeCard look up the user-owned
  // waypoint / track / shape from useFieldToolsStore. In a unit-test
  // environment the store is empty, so the Body short-circuits to a
  // "removed" Paragraph — the Hero (MetricCallout) is composed but
  // never reached. Testing the hero path requires seeding the store,
  // which is a test-infra task; the runtime hero is verified manually
  // by tapping a waypoint on the map. Documented synthetic ids per
  // docs/rules/ia.md ("My field tools" cross-cut).
  [
    "engage-mt-field-waypoint",
    "Store-gated — empty Vitest store falls through to removed-state Paragraph",
  ],
  [
    "engage-mt-field-track",
    "Store-gated — empty Vitest store falls through to removed-state Paragraph",
  ],
  [
    "engage-mt-field-shape",
    "Store-gated — empty Vitest store falls through to removed-state Paragraph",
  ],
]);

/**
 * Some renderers branch on attribute presence and only emit the hero
 * when the headline metric exists. The shared `@/test/fixtures` table
 * Covers the renderers that already have other / tests; this
 * map fills the conformance gap for renderers whose hero needs attrs
 * not present in the shared fixture (or that have no shared fixture
 * at all). Per-conformance overrides live HERE rather than in
 * `@/test/fixtures` so the hero-conformance contract is owned end-to-
 * end by this file and shared fixtures stay focused on the high-
 * traffic renderers' text-content tests.
 */
const HERO_ATTR_OVERRIDES: Record<string, Record<string, unknown>> = {
  // TrailCard composes HeroBlock when `miles` is present (see TrailCard's
  // readAttrs lookup in SEGMENT_LENGTH / GIS_MILES / Miles / trail_miles
  // / Length_Mi / LENGTH_MILES). The shared TrailCard renderer is
  // registered under six concrete layer ids; seed each so the hero
  // branch fires in the conformance run.
  "trails-usfs-nfs": { NAME: "Stuart Peak Trail", GIS_MILES: 4.7, DIFFICULTY: "Moderate" },
  "trails-nps-glacier": { NAME: "Highline Trail", GIS_MILES: 11.6, DIFFICULTY: "Strenuous" },
  "trails-nps-yellowstone": { NAME: "Mount Washburn", GIS_MILES: 6.4, DIFFICULTY: "Moderate" },
  "trails-lewis-clark": { NAME: "Mt. Helena Ridge", GIS_MILES: 5.1, DIFFICULTY: "Moderate" },
  "trails-missoula-county": { NAME: "Kim Williams Trail", GIS_MILES: 2.5, DIFFICULTY: "Easy" },
  "trails-bozeman-gvlt": { NAME: "Triple Tree Trail", GIS_MILES: 3.0, DIFFICULTY: "Easy" },
};

/**
 * Generic fallback for renderers without a shared fixture AND without
 * a hero-attr override. Hits the common headline keys most renderers
 * fall back to (NAME, COUNT, ACRES, REGION, …).
 */
const GENERIC_FALLBACK_ATTRS: Record<string, unknown> = {
  NAME: "Test Feature",
  TITLE: "Test Feature",
  LABEL: "Test Feature",
  ACRES: 1234,
  COUNT: 42,
  TOTAL_COUNT: 42,
  REGION: 3,
  COUNTY: "Madison",
  STATUS: "Open",
  DESCRIPTION: "Fixture-less generic fallback.",
};

const propsFor = (layerId: string) => {
  const fixture = FIXTURE_ATTRS[layerId];
  const override = HERO_ATTR_OVERRIDES[layerId];
  const merged = override
    ? { ...(fixture ?? {}), ...override }
    : (fixture ?? GENERIC_FALLBACK_ATTRS);
  return fixtureProps(layerId, { attrs: merged });
};

describe("every Tier-2 renderer leads with a Hero", () => {
  // Snapshot the registry at module-load. `index.ts`'s side effects
  // have already populated it via the import above.
  const ids = registeredLayerIds()
    .filter((id) => !HERO_EXEMPT.has(id))
    // Synthetic takeover ids that are NOT in HERO_EXEMPT still get
    // tested — their Body should still carry a hero unless explicitly
    // exempt.
    .sort();

  it.each(ids)("`%s` Body renders a HeroBlock / HeroPair / HeroValue / MetricCallout", (id) => {
    const renderer = resolveFeature(id);
    expect(renderer, `${id} should resolve to a registered renderer.`).not.toBeNull();
    if (!renderer) return;

    const Body = renderer.Body;
    const { container } = render(
      <MemoryRouter>
        <Body {...propsFor(id)} />
      </MemoryRouter>,
    );

    const hero = container.querySelector(HERO_SELECTOR);
    expect(
      hero,
      `${id} renderer Body did not emit any hero primitive (HeroBlock / HeroPair / HeroValue / MetricCallout). ` +
        "Compose one at the top of the Body — see docs/rules/feature-cards.md and docs/adrs/0022. " +
        "If the renderer is intentionally non-hero (minimal panel preview, custom visual hero, takeover-only " +
        "composition), add it to HERO_EXEMPT in this file with a one-line reason.",
    ).not.toBeNull();
  });

  it("HERO_EXEMPT entries correspond to real registered renderers", () => {
    const registered = new Set(registeredLayerIds());
    const stale: string[] = [];
    for (const id of HERO_EXEMPT.keys()) {
      if (!registered.has(id)) stale.push(id);
    }
    expect(
      stale,
      `HERO_EXEMPT contains layer ids that are no longer registered: ${stale.join(", ")}. ` +
        "Remove the stale entries — the underlying renderer is gone.",
    ).toEqual([]);
  });
});
