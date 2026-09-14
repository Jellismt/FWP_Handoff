# Feature Cards / Popup Registry — Engage MT Rules

The how-to-think-about-popups rule. The full spec is not included in this repo; this rule is the working reference.

## Primitive-first authoring

Before you write JSX in a renderer body, **scan `cardPrimitives.tsx` for the shape you need.** The primitive library has grown well past the original `MetricPill` / `Paragraph` / `ChipRow` triad. You almost certainly don't need new CSS or new component code.

The full set, grouped by what they're for:

| Want to show… | Use |
|---|---|
| A single dominant number (cfs, acres, ft, count) | `HeroBlock` (preferred) or `HeroValue` (compact) |
| A categorical headline with intent color (Open / Closed / Restricted) | `MetricCallout` |
| 2–4 related stat cells | `MetricGrid` + `MetricPill` (or `DomainPill` for hydro/weather/fire) |
| A row of boolean amenity / status chips | `ChipRow` or `BadgeRow` |
| Prose / narrative paragraph | `Paragraph` |
| A small section sub-heading inside the card body | `SectionHeading` (use this — don't write a bespoke `<h4>` with inline style) |
| De-emphasized inline qualifier ("approx.", "sample data") | `SubtleText` (use this — don't write `<span style={{ opacity: 0.7 }}>`) |
| 1–3 sentence plain-English explainer under a heading (Fulton's K, CFS, bonus-point squaring) | `ExplainerNote` (muted caption — lighter weight than `TipBlock`, no box, no icon) |
| A row of two cells (flow + temp) | `HeroPair` |
| Regulation / hazard / tip aside | `TipBlock` (intent: tip / info / warning / danger) |

If the shape you need isn't in the table above, look at the file — there are more primitives than this rule documents at any moment.

**If you write `<div className="my-card__thing">` inside a renderer body, you're almost certainly bypassing a primitive.** Stop and look first.

## When you encounter a new layer

Before adding a layer to `web/src/config/layers.ts`, decide its tier:

| Question | Answer → Tier |
|---|---|
| Will the layer ever be tapped by a typical user? | If no → **Tier 1** (generic), done. |
| Are there ≤ 4 attributes that matter at the tap moment? | If yes → **Tier 2** (branded card). |
| Does the feature have richer content (history, charts, related data) than a card can hold? | If yes → **Tier 3** (detail page). |
| Both Tier 2 + Tier 3 — card carries summary, "Open detail" routes to the page. | High-traffic features (BMA, hunting districts, WMAs, state parks). |

## DOs

- **Always register through the registry.** Never inline custom rendering in `TapQueryPanel`.
- **Compose from `cardPrimitives.tsx`.** `MetricPill`, `KeyValueRow`, `Paragraph`, `ChipRow`. No bespoke CSS per renderer.
- **Defensive attr parsing.** ArcGIS gives you `Record<string, unknown>`. Narrow at the top of the renderer.
- **Plain English values.** Convert codes (`STATUS=1`) to words (`Open`).
- **Cite via freshness chip** — already in the header, no extra work.
- **Detail-page routes follow `/<module>/<feature-type>/:id`.** Consistent paths.

## DON'Ts

- **Don't render attribute keys as labels.** A user shouldn't see `BMA_NAME` — they should see `Name`.
- **Don't fake data.** If the service doesn't carry a field, drop the pill.
- **Don't crash on missing attrs.** Renderers must be partial-data tolerant.
- **Don't add a Tier-2 renderer for a layer that gets tapped once a month.** Tier 1 is fine.

## Popup design system — weight + order

**Hero is mandatory.** every Tier-2 card MUST lead with exactly ONE of:
- `HeroBlock` — for numeric headlines (acres, cfs, °F, count). Default choice.
- `MetricCallout` — for categorical headlines where intent (success/warning/danger) carries the color cue (e.g. State Trust access status).

If a card has neither, it isn't Tier 2 yet — promote it or leave it Tier 1.

**Domain coloring.** Where a metric is a hydro/weather/fire/wildlife/park signal, prefer `DomainPill` over `MetricPill`. Domain and intent are orthogonal: intent owns the left stripe, domain owns the icon halo + value glyph. Domain tokens live in `brand-tokens.css` (`--fwp-domain-flow`, `--fwp-domain-temp`, `--fwp-domain-fire`, `--fwp-domain-fish`, `--fwp-domain-park`, `--fwp-domain-snow`, `--fwp-domain-wind`, `--fwp-domain-elev`, `--fwp-domain-drought`, `--fwp-domain-mercury`, `--fwp-domain-wildlife`).

**Live data has one idiom.** Pass `live` to `HeroBlock` and pair it with a visible "Live" / "Updated Xs ago" text label.

---

Compose every Tier-2 card from these slots in this order. Skip any slot
when the data doesn't justify it; never reorder.

```
1. Title row (badge + name)         ← shared by FeatureCardShell
2. Meta row (layer · subtitle)      ← shared
3. Hero — HeroValue / MetricCallout ← ONLY when there's ONE dominant number
4. MetricGrid — 2-4 MetricPills     ← always when ≥ 2 categorical attrs
5. ChipRow — boolean amenities      ← always when amenity-style flags
6. Paragraph — prose                ← when present
7. ConditionBar / chart             ← ONLY for position-on-scale / time-series
8. TipBlock (info/warning/danger)   ← regulation pointer, closure, danger
9. Enrichment — links + related     ← FWP page + PDF + Directions + cross-cards
10. Actions — Open detail, Save     ← shared
```

## Text vs chart decision rule

A chart earns its space only when ALL three are true:

1. The data is genuinely **time-series, count-by-category, or position-
   on-scale**. (Single counts → MetricPill, not a chart.)
2. The chart fits in ≤ **200 × 60 px** without overflow.
3. The chart's information gain over a bold numeric pill is **≥ 3×**.
   (If a user can read the number off the pill faster than they can
   interpret the chart, skip the chart.)

When in doubt, use a MetricPill. Charts that fail any of the three rules
are clutter.

## TipBlock intent legend

- `intent="tip"` (default) — soft amber. Use for angler tips, seasonal
  context, optional guidance.
- `intent="info"` — fish-blue. Use for explainers + neutral context
  (BLM rules, road-access context, etc.).
- `intent="warning"` — amber. Use for "refer to current regs", closures,
  permit-required.
- `intent="danger"` — red. Use for actual danger (severe drought, fire
  evacuation, swiftwater, no-public-access).

DO NOT use `intent="warning"` and expect red. The Phase
aligned color with the intent name.
- **Don't put long-running async fetches in the Body.** Enrichment blocks own that.
- **Don't mix Calcite popup chrome into a card.** We own the chrome via `FeatureCardShell`.

## File layout

```
web/src/components/map/featureCards/
├── index.ts          // side-effect import of every Tier-2 module so they register
├── core/             // the machinery — nothing here renders a specific feature
│   ├── types.ts             // FeatureRenderer, FeatureRendererProps
│   ├── registry.ts          // FEATURE_REGISTRY + registerFeature() + resolveFeature()
│   ├── cardPrimitives.tsx   // MetricPill, HeroBlock, TipBlock, … (the primitive library)
│   ├── FeatureCardShell.tsx // Header / body slot / actions / freshness chip
│   ├── FeatureCard.tsx      // registry-dispatch composer
│   ├── GenericCard.tsx      // Tier-1 fallback renderer (attr table)
│   ├── agencyResolver.ts    // land-agency resolution (+ cadastralHelpers.ts)
│   └── renderers.*.test.tsx // cross-renderer conformance suites
├── cards/            // one file per Tier-2 renderer (BmaCard, FasCard, GageCard, …)
└── enrichments/      // cross-cutting enrichment blocks (NearbyPublicAccessBlock,
                      //   NearbyPublicAccessBlock, LinkRow)
```

New renderer → `cards/<Name>Card.tsx`; import primitives from
`@/components/map/featureCards/core/cardPrimitives`; register via
`core/registry`; add the side-effect import to `index.ts` (which stays at the
featureCards root).

## Registering a renderer

```ts
import { registerFeature } from "./registry";
import { MetricPill, Paragraph } from "./cardPrimitives";

const Body: React.FC<FeatureRendererProps> = ({ attrs }) => (
  <>
    <MetricPill label="…" value={…} />
    {/* ... */}
  </>
);

registerFeature("layer-id-from-registry", {
  summary: (a) => String(a.NAME ?? "Untitled feature"),
  Body,
  detailRoute: (a) => (a.ID ? `/<module>/<type>/${a.ID}` : null),
});
```

Then import `./BmaCard` (etc.) from `featureCards/index.ts` so the side-effect registration runs at module load.

## Where cards appear

| Surface | Renderer source |
|---|---|
| `TapQueryPanel` feature group | FeatureCard via registry |
| Detail page header summary | `renderer.summary(attrs)` |
| Cross-module nav highlight | FeatureCard via registry, abbreviated |

## When in doubt

If a feature already has a detail page (`DistrictDetail`, `BmaDetail`, `WmaDetail`), prefer a Tier-2 card that links to it. Don't try to cram the detail page into the card.

If a Tier-2 renderer file would exceed ~200 lines, refactor: move primitives into `cardPrimitives.tsx`, or promote to Tier 3.

## Extended renderer surface

The FeatureRenderer interface now supports three optional fields beyond the original `summary` / `Body` / `Actions` / `Enrichment` / `detailRoute` / `subtitle`:

- **`presentation: 'panel' | 'takeover'`** — defaults to `'panel'`. Rich-feature renderers (WMA, State Park, BLM recreation site) declare `'takeover'`. TapQueryPanel auto-escalates a single-hit tap to the takeover modal portal when the renderer declares takeover.
- **`tabs: readonly FeatureRendererTab[]`** — when present, FeatureCardShell renders a small tab strip and routes the active tab's `Body`. The renderer's top-level `Body` still acts as the default content when no tabs are declared.
- **`Chart?: ComponentType<FeatureRendererProps>`** — dedicated chart slot rendered above the body in the takeover preset.

Every panel card surfaces a universal **"Expand"** action that dispatches to `takeoverPopupStore` so any feature can be promoted to a full-screen view.

## Shared primitives for popup bodies

Compose from these (defined in `cardPrimitives.tsx`):

- **`MetricPill` / `MetricGrid` / `ChipRow` / `Paragraph`** — original card primitives.
- **`HeroValue`** — large numeric headline with caption + optional delta.
- **`MetricCallout`** — boxed metric with intent color.
- **`TipBlock`** — soft-amber / red / blue aside with heading + body.
- **`BadgeRow`** — labelled label-chip row.
- **`ListCard`** — vertical key/value list with subtle dividers.

## Shared chart primitives

Inline-SVG; zero new dependencies; brand-token-driven (see `components/shared/charts/`):

- **`ConditionBar`** — segmented horizontal bar with marker pin + legend.

## Cross-cutting enrichment blocks

Composed into `FeatureCardShell.enrichment` (see `featureCards/enrichments/`):

- **`NearbyPublicAccessBlock`** — given a `tapPoint`, queries the public-access layers (BMA + FAS) within 5 mi and lists up to 3 closest of each with distance. Use for **private + tribal cadastral** hits (the resolver gates the composition); for public-agency hits the dedicated agency layer + the suggested-layer TipBlock cover the gap.
- **`LinkRow`** — consistent external-link row (FWP page, PDF, Directions).

> **Don't add a raw "Location context" dump** (lat/lon, DMS, UTM, county, HUC) to popups — the card answers the user's question, not coordinates. The `spatialContext/*` lookup services back `NearbyPublicAccessBlock` and `WaypointCard`; compose those instead.

## Bare-land owner resolution (empty tap)

A tap that produces **no** registered-layer hit does not dead-end at "No features here." `MapView`'s click handler calls `resolveLandOwnershipAtPoint(lon, lat)` from [`web/src/services/spatialContext/landOwnership.ts`](../../web/src/services/spatialContext/landOwnership.ts), which queries the MSDI cadastral parcel layer and returns its attributes. The result is **synthesized into the normal tap-query pipeline** as an `mt-cadastral` group, so the existing `CadastralCard` (BLM / USFS / state / private via `resolveAgency`) renders — no special-case rendering. When the service answers with no parcel, the panel shows the empty-tap notice; when the service cannot be reached, the failure is recorded and the panel says the spot could not be checked rather than claiming it is empty. An owner string the resolver cannot classify renders as "Ownership not determined" with the raw owner (treated as private for every warning) — never guessed private. Ungated by zoom.

## TapPoint plumbing

`FeatureRendererProps` carries an optional `tapPoint: { x, y, latitude, longitude, spatialReferenceWkid? }` — the click point that produced the card. Threaded from `MapView` → `MapPage` → `TapQueryPanel` → `FeatureCard` → renderer props, plus through the takeover store for "Expand to takeover" preservation.

- **Programmatic renders** (search hits, takeover-from-search) pass `tapPoint = undefined`. Enrichment blocks must return `null` when `tapPoint` is absent rather than crash.
- **Privacy** — the point stays on device. Spatial-context + nearby-features lookups hit the same kind of public REST endpoints the map view already uses; never sent to analytics or any behavior-tracking service. Per `docs/rules/privacy.md`.

## Enrichment-composition pattern for land-tenure cards

Land-tenure renderers (Cadastral, StateTrust, BMA, BLM, VTL hint card) follow this pattern:

```tsx
const Enrichment = ({ attrs, tapPoint }: FeatureRendererProps): JSX.Element | null => {
  // CadastralCard gates NearbyPublicAccess on the agency-resolver outcome
  // (private + tribal parcels only). Cards with no nearby-access need omit
  // the Enrichment field entirely.
  const showNearby = /* agency-resolver predicate */;
  return <>{showNearby && <NearbyPublicAccessBlock tapPoint={tapPoint} />}</>;
};

registerFeature(LAYER_ID, { ..., Body, Enrichment });
```

The FeatureCard composes `Enrichment` under the body.

## Data-layer lookups

Shared lookup modules under `web/src/services/data/` and `web/src/services/spatialContext/`:

- **`spatialContext/utm.ts`** — pure-JS WGS84 → UTM reduction; ±0.5 m at Montana latitudes.
- **`spatialContext/plss.ts`** — PLSS township / range / section lookup; rendered as a plain `MetricPill` by `CadastralCard`.
- **`spatialContext/nearby.ts`** — distance-bounded ArcGIS REST query with equirectangular distance sort. Used by `NearbyPublicAccessBlock`.

## Stream-gage cards

Both stream-gage sources (USGS NWIS and DNRC StAGE) render through one `GageCard`:
a `HeroPair` of two `HeroBlock`s (current flow, water temperature) fetched when
the card opens, with a `TipBlock` while loading or when the station has no
current reading. Keep it that shape — no charts, meters, or outlooks.

## Deferred-load layers

A LayerDef with `deferredLoad: true` is **never added to the ArcGIS map**. Use this for FWP-internal token-gated services until the corresponding `STUB-NNN` swap lands. LayerPanel automatically renders a "Sign-in" badge instead of the visibility toggle for these layers, and points the user at the Tier-2 fixture / Explorer page where the content is browsable.
