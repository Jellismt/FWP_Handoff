# Information Architecture — Engage MT Rules

This rule codifies how Engage MT's modules relate to layers, features, and cross-cutting concerns. It is the source of truth when there's a question of "where does this feature belong?"

Background ADRs: 0009 (map-as-substrate), 0014 (canonical ownership).

## Three tabs, five internal modules

The app presents **three tabs** (see [`web/src/config/navigation.ts`](../../web/src/config/navigation.ts) `MODULE_NAV`): **Hunt**, **Explore & Access**, and **My FWP**. Internally the `EngageMtModule` union keeps more ids than there are tabs. Of the ones layers actually use, `hunt`, `access`, `shared` and `reference` all own layers today; `fish` owns only the two hidden gage children, and no layer declares `explore` (its former layers now declare `access`, since they share that tab). `/access` and `/fish` paths light the merged tab via `altPathPrefixes`, and `manage` is presented as "My FWP" while keeping its internal id + `/manage` routes for deep-link stability.

| Module | Accent token | What it is | What it is NOT |
|---|---|---|---|
| **Hunt** | `--fwp-accent-hunt` (FWP red `#B3252E`) | Hunting activity: districts + district portions, district regulations | Not the place for non-hunt access questions |
| **Fish** | `--fwp-accent-fish` (FWP blue `#002855`) | Fishing-related layers: FAS, stream gages, river-mile markers, waterbody closures (surfaced through the Explore & Access tab) | Not the place for non-fish recreation |
| **Explore** | `--fwp-accent-explore` (brown `#744F28`) | Recreation: state parks, WMAs, trails | Not the place for hunt-specific or access-specific tools |
| **Access** | `--fwp-accent-access` (FWP green `#046A38`; flips to yellow-gold on dark) | "Where can I legally be?": cadastral, state trust land, BMA, federal recreation sites, FWP Public Access Program | Not the place for activity-specific regulations |
| **Manage ("My FWP")** | `--fwp-accent-manage` (graphite `#2D3748`) | Identity, account, and device: My FWP wallet; on the mobile app, My Device (offline tiles) + field tools | Not a spatial / discovery surface |

## Canonical owner per feature / per layer

Every feature and every layer has **exactly one canonical owner** — the module responsible for its data, its detail panel, its primary tools. Other modules may *back-reference* the feature (show it in their layer panel by default, link to it from a tap-query result), but they don't own its lifecycle.

### Layer ownership table

| Layer | `module` in the registry | Notes |
|---|---|---|
| Hunting districts (deer/elk + per-species: antelope, bighorn sheep, moose, mountain goat, upland bird, black bear, mountain lion) | `hunt` | Overlaid by Access for district-aware land tenure |
| District portions (elk, mule deer, white-tailed deer, antelope) | `hunt` | — |
| Wildlife biologist coverage areas | `hunt` | — |
| Game Warden Districts | `hunt` | Compliance context for Hunt and Fish |
| Fishing Access Sites (composite + boundaries + points) | `access` | An Explore & Access tool; the composite owns the panel row |
| State Parks (composite, boundaries, POIs) | `access` | — |
| WMAs (composite, boundaries, POIs) | `access` | Hunt regulations apply on WMAs |
| Trails / trailheads (USFS · NPS · MT counties, composite) | `access` | Children are `hiddenFromPanel` |
| BMA boundaries | `access` | Not default-visible |
| Federal recreation sites (BLM + BOR + USFS, composite) | `access` | UI-only composite; children stay real FeatureLayers with Tier-2 cards but `hiddenFromPanel: true` |
| FWP Public Access Program | `access` | — |
| Stream gages (USGS · DNRC) | `shared` composite, `fish` children | One "Conditions" row toggles both networks |
| Waterbody closures & restrictions | `shared` | — |
| Active fire points | `shared` | **Default-visible** |
| Wind stations | `shared` | **Default-visible** |
| NOAA radar reflectivity | `shared` | **Default-visible** |
| Public Lands VTL | `reference` | **Default-visible** |
| Public/private cadastral (Montana Cadastral) | `reference` | State trust land is a symbology class inside the Public Lands VTL, not its own layer |
| Major hydrography (MSDI 1:100k rivers + lakes) | `reference` | Composite; children `hiddenFromPanel` |
| River-mile markers | `reference` | — |
| Contours, mountain ranges | `reference` | — |
| AIS inspection stations | `reference` | Fish and Access context |
| CWD check stations | `reference` | Hunt context |
| License Ambassadors | `reference` | Where-to-buy context |
| My field tools (`engage-mt-field-tools`) — user waypoints / tracks / shapes | not in the registry | Tap-routes to synthetic ids `engage-mt-field-waypoint`, `engage-mt-field-track`, `engage-mt-field-shape` registered in [featureCards/index.ts](../../web/src/components/map/featureCards/index.ts) |

The registry holds **54 layers**; four are default-visible. `module` is the
single mechanism: it decides the panel group, the accent, and the popup badge.
Panel group ORDER is `MODULE_ORDER` in
[`LayerPanel.tsx`](../../web/src/components/map/LayerPanel.tsx), which leads with
Conditions and Reference.

`shared cross-cut` means the layer always loads regardless of active tab and is grouped under a "Conditions" section in the layer panel.

The field-tools layer is special: it's user-owned content (Tier 3 store, see [docs/rules/data-layer.md](data-layer.md)) rendered above operational layers via the dedicated `attachFieldGraphics()` helper. The map click handler hit-tests it FIRST so the user's own pins always take priority over operational features. Long-press (or right-click on desktop) drops a draft waypoint and routes the freshly-created pin into the same FeatureCard pipeline that any tap-to-query result flows through.

**GPS capture + offline tiles are mobile-only; waypoints work everywhere** (the web/mobile field-tool boundary). The web app is a *planning* surface, but **dropping a waypoint is a planning act**: the rail tool, the long-press/right-click gesture, and the tap-query "Drop a waypoint here" action all work on web, where the pin saves to browser `localStorage` and can be handed to a phone via **Send to phone** (a same-origin `/field/receive` link — no server, codec). Only **GPS track recording** and **offline tile download** stay gated behind `supportsGpsCapture` / `supportsOfflineDownload` in [`web/src/utils/capacitor.ts`](../../web/src/utils/capacitor.ts) and appear only in the Capacitor app.

## Cross-listed tools — the rule

A *tool* (not a layer) may be surfaced in a second module when both audiences
genuinely need it.
the tool keeps **one canonical owner** — file location, primary route, tracker
row — and the cross-listing is purely additive: an alias route in `App.tsx`, a
tool card on the second module's landing page, and pathname-derived chrome
(`data-module` accent, hero eyebrow, back-link) inside the component. Never
duplicate the component; never move it to `shared/`.

There are **no active cross-listings today** — the Explore & Access merged tab
covers the historical dual-audience cases. Keep the rule: any future
cross-listing follows the alias-route pattern above.

## Adding a new layer — the rule

Before adding a new layer to `web/src/config/layers.ts`:

1. **Identify the canonical owner** using the table above. If the layer doesn't fit any existing row, add it here first with rationale.
2. **Identify back-references** — which other modules should default-show or link to it.
3. **Identify the LayerDef.module** as the canonical owner.
4. **Identify the LayerDef.source** per [docs/rules/data-freshness.md](data-freshness.md).
5. **Identify whether tap-query should return regulation enrichment** at this feature type — if so, wire to the regulation-at-point service.
6. **Update the module-lens matrix** if the layer should be default-visible in any tab.
7. **Record the decision here** (owner + back-references) in the same PR.

## Cross-module discovery — the rule

**** Tap-query now returns the **single
topmost feature** the user clicked (the "popup is for the
thing I clicked" principle). The previous "every visible layer" behavior produced
crowded multi-popup panels that confused first-time users.
Cross-module discovery still works via:

- **The owning-module accent stripe** on the topmost-feature card itself,
  so users on Hunt who tap a Fish-owned feature (FAS, USGS gage) see the
  fish-blue accent stripe + the "FISH" module badge.

When a tap-query result is owned by a different module than the active tab, the result chip:

- Renders with the **owning module's accent color** (left-edge 4px stripe).
- Carries a small **module label badge** (`HUNT`, `FISH`, `EXPLORE`, `ACCESS`).
- Includes a **"View in {Module}"** action that switches tab + preselects the feature.
- Preserves the source tab as a **"Back to {SourceModule}"** chip via `crossModuleSourceStore`.

The tap-query panel's visual + interaction spec is implemented in `web/src/components/map/TapQueryPanel.tsx`.

## The "reference" pseudo-module

Some layers are pure map-context — users don't go to a module *to look for them*; they read them while looking for something else. These live in a `reference` pseudo-module that floats above Hunt at the top of `LayerPanel` so the context layers are easy to toggle without scrolling.

`reference` is distinct from `shared`:

- `reference` owns **static map context** the user reads passively (radar reflectivity, wind arrows, contours, mountain ranges, public-lands ownership VTL) plus the **cross-cutting check-station POINT networks** (AIS inspection + CWD sampling) — compliance/safety infrastructure relevant to anglers *and* hunters regardless of active tab.
- `shared` owns **cross-cutting Conditions** that ride on top of every spatial module: active fires + the hydrology family.

Current `reference` layers (9): `public-land-ownership`, `contours-elevation`, `engage-mt:wind-stations`, `mountain-ranges`, `noaa-radar-reflectivity`, `ais-inspection-stations`, `cwd-check-stations`, `warden-districts`, `license-ambassadors`. Per [`web/src/types/layers.ts`](../../web/src/types/layers.ts) the type union encodes this — don't introduce another non-canonical owner without updating both this rule and the type. The check-station + AIS layers are default-visible; `warden-districts` (game-warden coverage + contacts) and `license-ambassadors` (where to buy a license) are cross-cutting compliance/service layers, default-off. The CWD points load from FWP's live hosted PublicView service (real station DATES + DAY_TIME hours); the bundled `web/public/data/cwd-check-stations.geojson` remains the offline fallback.

## The "shared" pseudo-module

Some features are genuinely cross-cutting and don't belong to any single module:

- Layer-panel itself
- Locate-me
- Basemap switcher
- Theme toggle
- The about pages (privacy, attribution)

These live in `web/src/components/shared/` and are not gated by module. They are NOT another module — they are infrastructure.

## When in doubt

If you can't decide whether a feature is Hunt or Access, ask: **"What is the user's primary question?"**
- "Where can I hunt elk in unit 380?" → Hunt
- "Whose land is that, and can I walk on it?" → Access

If you can't decide whether a feature is Explore or Access, ask: **"Is this about doing something there, or being there?"**
- "Is there a trail up this drainage?" → Explore (doing — recreating)
- "Can I legally cross this parcel to reach the trailhead?" → Access (being — legal status)

If you can't decide whether a feature is Manage (My FWP) or Hunt, ask: **"Does this require my account?"**
- "Show my licenses" → My FWP (account-bound, even when the data is hunt-flavored)
- "What's the season for whitetail in district 380?" → Hunt (public regulation lookup)

Document the decision in the feature row's notes column when it's a close call.
