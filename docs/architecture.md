# Engage MT — system architecture

A one-stop technical overview for a developer or architect inheriting the
system. Per-domain depth lives in [rules/](rules/) and the folder runbooks;
this doc is the map.

## System topology

```
                       ┌────────────────────────────────────────────┐
 Browser ────────────▶ │  web            static SPA (nginx, $PORT)  │
                       │  React 19 + ArcGIS JS 5.x + Calcite 5.x    │
 Mobile app = the SAME │  root Dockerfile → build + serve            │
 web build wrapped in  └──────────────┬─────────────────────────────┘
 Capacitor (mobile/)                  │  public read API  /api/v1|v2/fwp/*
                                      ▼
                       ┌────────────────────────────────────────────┐
 Staff (browser) ────▶ │  regs API + staff console (Fastify, $PORT) │
 staff SPA at "/"      │  server/Dockerfile → API + staff/ SPA      │
                       └──────────────┬─────────────────────────────┘
                                      │  DATABASE_URL
                                      ▼
                       ┌────────────────────────────────────────────┐
                       │  Postgres — tabular regs system of record  │
                       │  stores NO geometry                        │
                       └────────────────────────────────────────────┘

 ┈┈┈ EXTERNAL (not hosted by this system) ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
 FWP ESRI ArcGIS Server (fwp-gis.mt.gov) + other public services
 (USGS, NOAA, BLM, USFS, MSDI, …). The web/mobile clients query these
 DIRECTLY for geometry and live conditions, joined to regs data by CODE.
```

Two deployable containers (web, regs API) + one Postgres + external public GIS
services. The mobile app is not a service — it is the same `web/dist` artifact
wrapped by Capacitor.

## Workspaces

| Workspace | Role | Key entry points |
|---|---|---|
| `shared/` | Cross-workspace contracts | `shared/src/arcgisLayers.ts` (GIS linkage registry) |
| `web/` | Public SPA | `web/src/main.tsx`, `web/src/App.tsx` |
| `mobile/` | Capacitor 8 wrapper | `mobile/capacitor.config.ts` (`webDir: ../web/dist`) |
| `server/` | Regs Manager API | `server/src/app.ts` (route registration), `server/src/db/` (migrations, seed) |
| `staff/` | Staff editing console | Vite SPA; built into the server image and served at `/` |

## Web app structure

```
web/src/
├── components/
│   ├── hunt/  fish/  explore/  access/  manage/   # per-tab pages + tools
│   ├── map/                                       # the map substrate
│   │   ├── featureCards/                          # tap-to-query card registry
│   │   │   ├── core/      # registry, FeatureCardShell, cardPrimitives, conformance tests
│   │   │   ├── cards/     # one renderer per feature type (BmaCard, FasCard, GageCard, …)
│   │   │   └── enrichments/
│   │   └── …               # MapView, layer lifecycle, tool rail, tap-query panel
│   ├── field/                                     # waypoints, measure/draw
│   └── shared/                                    # header, search, primitives
├── config/          # layers.ts (LAYER_REGISTRY), navigation.ts, offlineBasemaps.ts
├── hooks/           # useFetchJson, useAsyncState, useDistrictRegulations, …
├── services/        # regsApi/, data/, spatialContext/, public/, stubs/, …
├── store/           # Zustand stores: app/, map/, field/, account/
├── styles/          # brand-tokens.css + global.css (design tokens)
└── types/  utils/
```

### Three tabs, one map

The UI is three routes — Hunt, Explore & Access, My FWP (route `/manage`)
— over a single persistent ArcGIS `MapView`. Switching tabs changes which
layers are visible by default, which tools appear, and the accent color; the
map itself persists. Module ownership rules (which tab "owns" which layer or
tool) are codified in [rules/ia.md](rules/ia.md).

### Layer registry

Every map layer is declared once in `web/src/config/layers.ts`
(`LAYER_REGISTRY`, 54 entries). A `LayerDef` carries the service URL, owning
module, default visibility, freshness category, attribution, and
Montana-scoping strategy. Components reference layers by id — never inline
service URLs. National services must declare how they are scoped to Montana
(server-side `definitionExpression`, GPU-side clip, or a documented note) —
enforced by `npm run check:montana-scoping`. See [rules/arcgis.md](rules/arcgis.md).

### Feature-card registry (tap-to-query)

Tapping the map queries visible layers and renders the topmost hit as a
"feature card." Renderers are registered per layer id in
`web/src/components/map/featureCards/` (`registerFeature(layerId, {...})`),
composed from a shared primitive library (`cardPrimitives.tsx`) inside a common
`FeatureCardShell`. Conformance tests assert every registered layer has a
renderer and every card meets the design contract. See
[rules/feature-cards.md](rules/feature-cards.md).

### State

Zustand stores, grouped by concern under `web/src/store/` (`app/` — theme,
toasts, connectivity; `map/` — view, layers; `field/` —
waypoints, drawings; `account/` — wallet). Persisted keys go through
`persistedKey.ts`; on mobile, persistence is backed by Capacitor Preferences.

### Services

`web/src/services/` holds all data access. Highlights:

- **`regsApi/`** — the live regulations client; **`regs/`** — the bundled regs
  snapshot it falls back to offline (below).
- **`data/`** — typed loaders for bundled reference datasets (URL constant +
  in-memory filtering, e.g. `districtFacts.ts`).
- **`public/`** — anonymous public-API clients (USGS, NWS/AHPS, warden lookup, …).
- **`spatialContext/`** — point-in-polygon lookups against public
  ESRI services (county, district, land ownership) + the on-device
  `pointInFeatures` primitive.
- **`stubs/`** — clearly-fake implementations of FWP-authenticated endpoints
  (sign-in, license wallet), each with a contract doc in
  [stubs/](stubs/README.md) and a registry gated by `npm run check:stubs`.

## Regulations data flow (the regs three-tier client)

Hunting-district regulations are **tabular data with a lifecycle**, so they are
served by a real backend (`server/`) rather than bundled config. The web client
(`web/src/services/regsApi/client.ts`) resolves every regs request through a
fallback chain:

1. **Live API** — the Regs Manager public read API. The base URL is baked at
   build time from `VITE_FWP_API_V2_BASE` (explicit), else
   `VITE_FWP_REGS_API_BASE` (used by the mobile build so regs go live when
   online while other bundled data stays local), else `VITE_FWP_API_BASE`
   (v1-shaped bases are rewritten `/api/v1/` → `/api/v2/`).
2. **Stored copies** — every successful response is written to Cache Storage
   and, on the device, to a file under the app data directory (the "field
   copy", which survives web-view cache eviction). On network failure or 5xx
   the newer of the two is served.
3. **Bundled snapshot** — `web/public/data/regs-snapshot.json`, a
   committed build-time export of the published regulations
   (`scripts/build-data/build_regs_snapshot.mjs`, run via `npm run data:regs`
   in `web/`). This is the offline floor: what a never-been-online fresh
   install shows. `npm run check:regs-floor` fails the verify gate when it is
   older than 90 days or past its `validUntil`.

Every result carries a freshness descriptor (`tier`, `version`,
`effectiveDate`, `stale`) so the UI names the copy it is showing and never
presents a stored or bundled copy as live
([rules/data-freshness.md](rules/data-freshness.md)). A fallback result is
reused only while offline; a connectivity change clears the session cache.
When no base URL is set at all, the client is offline-first by construction
(stored copies → bundle).

### The Regs Manager backend

- **Postgres** is the system of record: numbered, append-only SQL migrations in
  `server/src/db/migrations/`, a seed script, and ETL loaders
  (`server/package.json` `etl:*` scripts). Publishing produces immutable
  versioned snapshots that the public API serves.
- **Fastify API** (`server/src/app.ts`): public read routes at `/api/v1/fwp/*`
  and `/api/v2/fwp/*`, staff auth + CRUD at `/api/v1/staff/*`, health at
  `/api/v1/healthz`, print-to-PDF export, and the built staff SPA served
  statically at `/`.
- **Staff console** (`staff/`) is where FWP staff edit and publish
  regulations (a separate backend surface; the web app only consumes its
  published API — see [deploy/regs-api.md](deploy/regs-api.md)).

### GIS linkage — geometry never lives in the database

The regs database stores **no geometry**. District, portion, and
restricted-area records carry codes that join to FWP's live public ESRI layers,
and `shared/src/arcgisLayers.ts` is the one place the service URL + layer id +
join field per geography is defined. The server ETL imports it, the web layer
registry is checked against it (`npm run check:gis-registry`), and migrations
carry `-- oracle-note:` comments (by convention) so the schema ports to Oracle
near-mechanically.
Spatial identification is client-side: tap → query the public district layer →
get a code → ask the regs API for that code's tabular regs.

## Reference data (bundled JSON + manifest)

Non-regulatory reference data (hunting-district facts, the USGS gage
catalog, …) ships as plain JSON under `web/public/data/`, registered in
`web/public/data/data-manifest.json`. Each manifest entry carries
`effectiveDate`, `source`, and `schemaVersion`; the UI surfaces these as
freshness chips. Consumers fetch the bundled `/data/<slug>.json` lazily via
`useFetchJson` through a typed loader in `services/data/` — there is no runtime
manifest resolver and no client-side query engine. Datasets are regenerated by the builders in `scripts/build-data/`
(see [deploy/data-refresh.md](deploy/data-refresh.md)); `npm run check:manifest`
and `npm run check:data-freshness` gate manifest integrity.

## Mobile

`mobile/` wraps `web/dist` in Capacitor 8 (WKWebView / Android WebView). There
is no separate mobile React tree — features ship to web first, then sync.
Native seams (status bar, deep links, hardware back, geolocation, filesystem)
are guarded behind capability predicates so the same bundle runs on web
([rules/mobile.md](rules/mobile.md)). The mobile build sets
`VITE_FWP_REGS_API_BASE` so regulations fetch live when online, while bundled
reference data keeps the app fully functional offline. Build pipeline:
[mobile/](mobile/README.md).

## Quality architecture

One command — `npm run verify` — is the merge gate: lint, type-check, unit
tests with ratcheting coverage floors, production build, and 16 static audit
checks (bundle budget, manifest integrity, CSP allowlist drift,
security-header parity, stub registry, Montana scoping, GIS-registry drift,
Capacitor import guards, and more). `npm run verify:e2e` adds the Playwright
end-to-end + axe accessibility suite. Details:
[development.md](development.md).

## Privacy architecture

Local-first, enforced structurally, not aspirationally:

- **No telemetry of any kind** — no analytics SDK, no error-reporting service,
  no behavioral tracking. Diagnostics are written locally and exported only by
  the user.
- **User location never leaves the device.** Geolocation results stay in the
  React tree; waypoints persist to local storage / Capacitor Preferences.
- **No third-party CDNs at runtime** — fonts and Calcite assets are
  self-hosted; the CSP allowlist is audited (`check:csp-allowlist`).
- **External public APIs** (USGS, NOAA, ESRI services) receive anonymous
  requests with no identifiers.
- **There is no auth client to leak.** Sign-in is inert and the licence wallet
  is a local fixture until FWP's endpoint lands (STUB-001).

The full rule — including what a code review must check — is
[rules/privacy.md](rules/privacy.md).

---

Licensed under the MIT License.
