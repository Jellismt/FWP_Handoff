# Engage MT

![License: MIT](https://img.shields.io/badge/license-MIT-FFC72C?labelColor=002855)
![Version 1.0.0](https://img.shields.io/badge/version-1.0.0-FFC72C?labelColor=002855)
![React 19](https://img.shields.io/badge/React-19-002855?labelColor=B1B3B3)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5-002855?labelColor=B1B3B3)
![ArcGIS Maps SDK 5](https://img.shields.io/badge/ArcGIS_JS_SDK-5.x-002855?labelColor=B1B3B3)
![Capacitor 8](https://img.shields.io/badge/Capacitor-8-002855?labelColor=B1B3B3)
![Fastify + PostgreSQL](https://img.shields.io/badge/Fastify-PostgreSQL-002855?labelColor=B1B3B3)

Montana's gateway to the outdoors — a free, state-built web and mobile
application giving hunters, anglers, and recreationists authoritative access to
public lands, hunting regulations, and outdoor-recreation data, powered by
Montana Fish, Wildlife & Parks' own data.

> **Taking over this codebase?** Start at [DOCS.md](DOCS.md) — the master key to
> every handover document — then read
> [docs/codebase-overview.md](docs/codebase-overview.md) (what the pieces are,
> how big each is, how to run the tests, and the safe change-and-verify loop).

The map is the universal substrate: one persistent ArcGIS map underlies every
tab, with per-tab default layers, tap-to-query feature cards, waypoint drop,
and measure/draw tools.

## Repository layout

npm-workspace monorepo, five workspaces:

| Workspace | What it is |
|---|---|
| `web/` | The public app — React 19 + Vite 6 + TypeScript 5 + ArcGIS Maps SDK for JS 5.x + Calcite 5.x + Zustand + React Router 7 |
| `mobile/` | Capacitor 8 native wrapper (iOS + Android) around the same `web/dist` build |
| `server/` | FWP Regs Manager API — Fastify + Postgres; the tabular system of record for hunting regulations, plus the public read API |
| `staff/` | Internal staff console (Vite + React SPA) for authoring and publishing regulations; served by the `server/` container |
| `shared/` | Cross-workspace contracts, including `shared/src/arcgisLayers.ts` — the single-source registry linking regulation records to FWP's public ESRI GIS layers by code (the regs database stores **no geometry**) |

## What's in v1.0

Three tabs, each a lens over the shared map:

### Hunt
- **Hunting Districts** — browsable district list + per-district detail tabs
  (regulations and season windows), fed **live** by the Regs Manager API with
  cached and bundled fallbacks

### Explore & Access
- **State Parks** · **Wildlife Management Areas** · **Fishing Access Sites** ·
  **Trails** — recreation layers on the map
- **Block Management Areas** · **Public/Private Ownership** (cadastral parcels,
  state trust land, BLM) — "where can I legally be?"

### My FWP
- Sign-in seam (stubbed — real FWP account integration is a documented
  contract, see `docs/stubs/`) and license/tag wallet display; on the
  mobile app it adds the device pages: My Device (storage + offline
  tiles) and Field Tools (waypoints, tracks, measure/draw)

### The map
Registered layers live in `web/src/config/layers.ts`, including: hunting
districts and species-specific district portions, fishing access sites, state
parks, WMAs, trails (USFS, NPS, county), block management areas, cadastral
parcels, state trust land, BLM lands, federal recreation sites, stream gages
(USGS/DNRC), major rivers & lakes, river mile markers, and the Conditions /
Reference layers (NOAA radar, wind arrows, active wildfires, waterbody
closures, public lands, game warden districts, AIS inspection stations, CWD
check stations, license ambassadors, elevation contours, mountain ranges).
Tapping any feature opens a purpose-built feature card from the registry in
`web/src/components/map/featureCards/`.

## Quick start

Prerequisites: **Node 20+** and npm 10+. Docker is needed only for the
full-stack parity run (or bring your own Postgres for the regs API).

```bash
npm install                    # installs all five workspaces
```

**Web app** (works standalone — regs fall back to the bundled snapshot):

```bash
npm run dev                    # Vite dev server → http://localhost:5173
```

**Full stack** (web + regs API + Postgres, the production images):

```bash
npm run stack:up               # docker compose up --build
# web → http://localhost:8088   api → http://localhost:8080/api/v1/healthz
npm run stack:down
```

**Regs API alone** (against your own Postgres):

```bash
cd server
DATABASE_URL=postgres://user:pass@host:5432/regs npm run migrate
DATABASE_URL=... npm run seed
DATABASE_URL=... npm run dev   # Fastify → http://localhost:8080
```

**Staff console** (needs the API on :8080):

```bash
npm run dev --workspace @engage-mt/regs-staff   # → http://localhost:5174 (proxies /api)
```

**Mobile builds** (macOS; see [docs/mobile/](docs/mobile/README.md)):

```bash
npm run mobile:doctor          # toolchain readiness check
npm run mobile:bootstrap       # one-time toolchain install (Homebrew)
npm run apk                    # Android debug APK
npm run ios:sim                # iOS simulator app
```

## Quality gate

Every change must pass the local verify gate before merge:

```bash
npm run verify                 # lint · type-check · every workspace's tests · build · 16 audit checks
npm run verify:e2e             # Playwright e2e + axe accessibility sweep (opt-in; needs network)
bash scripts/ci.sh             # the same gate for a hosted runner (verify + e2e + secret scan)
```

See [docs/development.md](docs/development.md) for what each check does.

## Documentation

**[DOCS.md](DOCS.md)** is the master key. Highlights:

- [docs/codebase-overview.md](docs/codebase-overview.md) — **start here**: the workspaces, how big each is, the test suite, and how to run tests + verify a change
- [docs/architecture.md](docs/architecture.md) — system overview
- [docs/development.md](docs/development.md) — dev workflow, testing, how to extend
- [docs/regs-manager/](docs/regs-manager/README.md) — the FWP Regs Manager: app, API, DB, staff console, Railway/access handover
- [docs/deploy/](docs/deploy/README.md) — web deploy (Docker/nginx), regs API, data refresh, DB backup/restore
- [docs/mobile/](docs/mobile/README.md) — Android/iOS builds and store release
- [docs/rules/](docs/rules/) — per-domain engineering conventions (ArcGIS, Calcite, accessibility, privacy, testing, …)

## Known limits and FWP-side dependencies

Everything below needs an FWP decision or credential, not code, and is called
out so it lands in the right risk register:

- **MyFWP sign-in and the license wallet** are a documented seam
  ([STUB-001](docs/stubs/STUB-001.md)); the app ships an inert sign-in and a
  fixture wallet until FWP's XMT OAuth endpoint is available.
- **Offline basemap tiles** download from USGS The National Map (public
  domain, `web/src/config/offlineBasemaps.ts`) at zoom levels 6–16; the online
  map keeps its Esri basemaps. Tiles are stored as ordinary image files and
  served to the map by the native web view, so there is no encoding overhead on
  disk or per tile drawn. Removing an area deletes its files; a lost index is
  rebuilt from the mirrored copy on next launch. One known gap: on iOS the tile
  tree is not yet excluded from iCloud backup, which needs a small native
  addition ([docs/rules/mobile.md](docs/rules/mobile.md)).
- **GPS track recording is foreground-only — a product decision, not a platform
  ceiling.** The screen stays awake while recording; locking the phone or
  switching apps pauses it, and the track resumes as a new segment rather than
  drawing a straight line across the gap. Background recording is reachable
  from this architecture through a background-geolocation plugin, and the cost
  is the reason it is not enabled: an Android foreground service with a
  permanent notification and a second "allow all the time" permission prompt,
  the iOS always-on location authorization and its status-bar indicator, a
  background-location declaration and demo video for Play review plus an App
  Store justification, and no MIT-licensed plugin that is validated on the
  Capacitor major this app targets. It also changes what the app tells users
  about location, which is FWP's decision to make rather than an engineering
  one. `check:native-config` fails the build if the permission is ever declared
  without the service, notification permission, and iOS purpose string behind
  it, so the capability cannot be half-shipped.
- **Geofenced alerts and push notifications** are not built. Push is a backend
  gap rather than a client one: the transport is the same for any client, and
  it needs FWP-provisioned Apple and Firebase credentials plus a sender. OS
  geofencing is capped at 20 monitored regions on iOS and 100 on Android, for
  native and hybrid apps alike, so covering arbitrary district or closure
  polygons is a design problem rather than a framework choice.
- **Hosting** is two stock Docker images ([docs/deploy/](docs/deploy/README.md));
  the current Railway project is a convenience, not a requirement, and moves to
  SITSD-managed infrastructure with a database restore
  ([docs/regs-manager/railway-handover.md](docs/regs-manager/railway-handover.md)).
- **Server database tests** need a local Docker daemon
  (`npm run test:server --workspace server`).

## Repository history

This repository is a clean snapshot of the shipped v1.0.0: one commit, one
tag. The prototype's development history is intentionally not included.

## Privacy

Local-first by design: no telemetry, no analytics, no third-party trackers, and
user location never leaves the device. This is a hard rule enforced at review
time — see [docs/rules/privacy.md](docs/rules/privacy.md).

## License

Licensed under the MIT License. See [LICENSE](LICENSE).
