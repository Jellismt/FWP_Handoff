# `services/` — non-React logic, by domain

Services hold everything that isn't a component: fetching, domain math,
platform bridges. Two iron rules:

1. **All external fetch goes through [`utils/http.ts`](../utils/http.ts)**
   (`fetchJson` / `fetchText` / `withBackoff`) — typed errors, timeouts,
   abort-merge, retry. A bare `fetch()` is a review-blocking smell (the one
   sanctioned exception: the resumable tile downloader in `mobile/`).
2. **FWP-authenticated endpoints are stubbed** under `stubs/` with a
   `STUB-NNN` contract until credentials land
   ([data-stubs.md](../../../docs/rules/data-stubs.md)).

| Domain            | One-liner                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `cache/`          | TTL cache + last-good-snapshot primitives                                                                                  |
| `data/`           | Manifest loader + bundled dataset catalogs                                                                                 |
| `field/`          | Waypoints, tracks, GPX/KML import-export, pin-share codec                                                                  |
| `hunt/`           | District season windows, regulations fetch, live district facts (see its own [README](hunt/README.md))                     |
| `hydrology/`      | Live stream-gage readings: the DNRC StAGE client + the USGS/DNRC source dispatcher                                         |
| `map/`            | Map helpers that aren't components (extent, geometry ops)                                                                  |
| `mobile/`         | Capacitor bridges: app lifecycle, native chrome, tiles — ALL platform-guarded ([mobile.md](../../../docs/rules/mobile.md)) |
| `public/`         | REST clients for public, no-auth data hubs (USGS/NOAA/DNRC/MSL) — see its own [README](public/README.md)                   |
| `regs/`           | **Bundled** regs: the build-time snapshot + PDF index shipped with the app (offline fallback)                              |
| `regsApi/`        | **Live** regs: the FWP Regs Manager API client + typed rows; falls back to `regs/` when offline                            |
| `spatialContext/` | Point-in-polygon context: county/district/HUC/tribal/nearby, plus the on-device `pointInFeatures` primitive                 |
| `stubs/`          | Every `.stub.ts` awaiting FWP endpoint access + fixtures + registry                                                        |
