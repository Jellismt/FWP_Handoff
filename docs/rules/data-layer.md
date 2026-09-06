# Data Layer — Engage MT Rules

The how-to-think-about-data rule. Companion:
[data-freshness.md](data-freshness.md).

## Three tiers — pick one

| Tier | Use it for | Examples |
|---|---|---|
| **Tier 1 — Spatial** | Anything with a geometry that lives on the map | BMA polygons, FAS points, stream gages, radar tiles |
| **Tier 2 — Curated** | Tabular / facts data that is read-only, versioned, public | Hunting-district facts, USGS gage catalog |
| **Tier 3 — Session** | User state, ephemeral, per-device | Theme preference, last camera, draft form data, waypoints |

If a piece of data fits more than one tier, the precedence is
**Tier 1 > Tier 2 > Tier 3** — start spatial, fall back to tabular, fall back
to session.

> **Regulations are none of these.** Hunting regulations have a lifecycle
> (draft → publish → correct) and live in the Regs Manager Postgres, served by
> the public API with cached + bundled fallbacks — see
> `web/src/services/regsApi/` and [../architecture.md](../architecture.md).

## Tier 2 — bundled JSON + manifest (no query engine)

Tier-2 datasets are **plain JSON files** under `web/public/data/`, registered
in `web/public/data/data-manifest.json`, fetched lazily, and filtered
**in memory** in a small typed service module. There is deliberately no
client-side query engine — dataset sizes here don't justify one.

### Where things live

- **Curated sources + builders:** `scripts/build-data/sources/` +
  `scripts/build-data/build_<dataset>.mjs`, run via `npm run build:data`
  (from `web/`), which regenerates the JSON **and** the manifest.
- **Manifest:** every entry carries `effectiveDate`, `source`,
  `schemaVersion`, and an integrity hash. Gated by `npm run check:manifest`
  and `npm run check:data-freshness`.
- **Runtime consumption:** a component reads a dataset by fetching its bundled
  `/data/<slug>.json` **lazily via `useFetchJson`**, through a typed domain
  loader (below) — there is no central resolver or query engine. Datasets ship
  in the app bundle and are served same-origin (offline-first on mobile).
- **Freshness metadata for the UI:** the dataset payload / its loader carries
  `effectiveDate` + `source`; the consumer passes those straight to
  `<FreshnessChip>` as props. The manifest itself is a **build + gate** artifact
  (integrity + freshness checks), not loaded by the app at runtime.
- **Domain lookup modules:** small typed wrappers under
  `web/src/services/data/` (e.g. `districtFacts.ts`) own the URL constant + the
  in-memory filtering — components never re-implement it.

### Decision tree

```
Is this regulations data (lifecycle, staff-edited)?
├── YES → the regs API client (services/regsApi) — never bundle-only
└── NO
    Is this UI state (open/closed, hover, selected, theme)?
    ├── YES → Zustand store or React state
    └── NO
        Is this spatial (has a geometry)?
        ├── YES → Tier 1 — ArcGIS layer + queryFeatures
        └── NO
            Is this user-owned / per-device?
            ├── YES → Tier 3 — store + @capacitor/preferences
            └── NO  → Tier 2 — JSON + manifest entry
```

## DON'Ts

- **Don't** add a new TS/JS module of static data in `web/src` — reference
  data belongs in `public/data/` behind the manifest.
- **Don't** fetch a dataset with a bare `fetch()` in a component — go through
  the domain lookup module in `services/data/` with `useFetchJson`, so the URL
  constant, typing, and in-memory filtering stay in one place.
- **Don't** ship a dataset without a manifest entry, and don't edit generated
  JSON by hand — change the source + builder and regenerate.
- **Don't** ignore a `schemaVersion` mismatch warning — regenerate the data or
  update the consumer; never silence it.

## DOs

- **Do** show a freshness chip ("Effective 2026-03-01") next to any UI block
  backed by Tier-2 data ([data-freshness.md](data-freshness.md)).
- **Do** keep dataset JSON lazy — fetched on first use, never value-imported
  into the bundle.
- **Do** put filtering/derivation logic in the typed service module next to
  its tests, not in components.

## Adding or migrating a dataset

1. Add/update the source + builder under `scripts/build-data/` (wired into
   `build_all.mjs`).
2. Schema change? Bump the dataset's `schemaVersion` in its manifest entry.
3. Regenerate: `npm run build:data` (from `web/`).
4. Update the consumer service/hook.
5. `npm run verify` — `check:manifest` + `check:data-freshness` gate the result.

## Offline (Capacitor) — the rule

Tier-2 JSON ships in the app bundle (Vite `public/data/`) and is served
same-origin by Capacitor's local bundle server — bundled data is inherently
offline with no copy step. The `useFetchJson` call is platform-blind: same
same-origin `/data/<slug>.json` fetch, web or mobile.
