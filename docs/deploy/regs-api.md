# Deploying the regs API (+ staff console)

One container serves three things: the **public read API** (`/api/v1/fwp/*`,
`/api/v2/fwp/*`), the **staff CRUD API** (`/api/v1/staff/*`), and the built
**staff SPA** (served statically at `/`). Built by `server/Dockerfile` with the
**repo root as build context** (it needs `shared/` and `staff/`):

```bash
docker build -f server/Dockerfile -t engage-mt-regs .
docker run -p 8080:8080 \
  -e DATABASE_URL=postgres://user:pass@host:5432/regs \
  -e SESSION_SECRET=<random ≥16 chars> \
  -e SKIP_POSTGIS=1 \
  -e PUBLIC_CORS_ORIGINS=https://<your-web-host> \
  -e SEED_ADMIN_EMAIL=admin@example.gov \
  -e SEED_ADMIN_PASSWORD=<≥14 chars> \
  engage-mt-regs
```

Boot sequence (the image CMD): **migrate up → seed → serve**. Migrations are
numbered, append-only SQL in `server/src/db/migrations/`; the seed is
idempotent (reference vocabularies, GIS-layer registry rows, and the first
admin user when `SEED_ADMIN_*` are set). Restart-on-failure is safe.

Health: `GET /api/v1/healthz` → 200 (pings the database). The image declares a
Docker `HEALTHCHECK` against the same path. Expired and idle staff sessions are
swept on boot and hourly by the API itself.

## Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. TLS defaults to `require` in production. |
| `SESSION_SECRET` | yes | ≥16 chars; signs staff session cookies. |
| `SKIP_POSTGIS` | recommended (`1`) | The regs DB is **tabular — it stores no geometry** (GIS lives in FWP's external ESRI layers, linked by code). `SKIP_POSTGIS=1` skips the one legacy PostGIS migration so a **stock Postgres image works**; a later migration drops the retired geometry sidecars harmlessly. Only unset if your Postgres actually has PostGIS installed. |
| `PUBLIC_CORS_ORIGINS` | yes (prod) | Comma-separated origins allowed to call the public read API — set to your web app's origin(s), plus Capacitor app origins for mobile. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | first boot | Creates the initial staff admin (password ≥14 chars). Rotate via the staff console afterwards. |
| `PORT` | no (default 8080) | Fastify listen port. |
| `NODE_ENV` | yes (`production`) | |
| `STAFF_IP_ALLOWLIST` | no | Optional comma-separated allowlist for `/api/v1/staff*`: exact IPs and CIDR ranges, IPv4 or IPv6 (e.g. `203.0.113.0/24,2001:db8::/32`). A malformed entry stops the API from booting. Leave unset to allow any IP. |

## Database + data

- **Postgres 16 or newer**, stock image — no extensions required with
  `SKIP_POSTGIS=1`.
- **Schema** is fully reproducible from the migrations + seed.
- **Regulation content** arrives one of two ways:
  1. **Restore a database dump** (the normal path when inheriting an existing
     environment) — see [db-backup-restore.md](db-backup-restore.md).
  2. **Rebuild via ETL** from the source materials — the loaders are the
     `etl:*` scripts in `server/package.json`.
- The optional `npm run sync:districts` ETL pulls current district codes from
  FWP's public ArcGIS server (`fwp-gis.mt.gov`) — the only step that needs
  outbound network.

## Print-to-PDF note

The image includes Chromium (~150 MB) solely for the staff "print regulation
book to PDF" export, driven by puppeteer-core as the non-root `node` user.
Only the print endpoint loads it.

## Platform gotchas (verified on Railway; general to similar PaaS)

- **Config-file path must be set per service.** Deploying from the repo root
  reads the **root** `railway.json` (the web app's Dockerfile). For the regs
  service to build from `server/Dockerfile`, point that service at
  `server/railway.json`. On Railway there is **no CLI command** for this — set
  the service's config-file path in the dashboard (service → Settings →
  Config-as-code), or via the GraphQL API (`serviceInstanceUpdate` with
  `railwayConfigFile: "server/railway.json"`). Setting a
  `RAILWAY_DOCKERFILE_PATH` variable alone does **not** override the root
  config file.
- **`SKIP_POSTGIS=1`** — managed Postgres plugins are typically stock images
  without PostGIS; the build/boot fails on the geometry migration without it.
- **`npm ci --ignore-scripts` in the server image is intentional.** The root
  workspace install would otherwise run every workspace's lifecycle hooks —
  including the web workspace's bash-based Calcite asset postinstall, which
  needs files this image never copies. The server's own native deps resolve
  from platform optional-deps and need no install scripts. Don't "fix" it.
- **CLI deploys upload the working tree** — uncommitted changes ship. Deploy
  from a clean checkout of the release commit.
- After attaching the public domain, set it as the web build's
  `VITE_FWP_API_BASE` — the Docker build injects that origin into the web CSP
  `connect-src` automatically, so there's nothing else to wire ([web.md](web.md)).

## Local development

```bash
cd server
DATABASE_URL=postgres://localhost:5432/regs npm run migrate
DATABASE_URL=... npm run seed
DATABASE_URL=... npm run dev            # tsx watch → :8080
npm run test                            # unit; npm run test:server spins a Docker Postgres
```

The staff console dev server (`npm run dev --workspace @engage-mt/regs-staff`,
port 5174) proxies `/api` to `localhost:8080`.
