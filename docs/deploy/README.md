# Deployment

Engage MT deploys as **two portable containers + one Postgres database**.
Nothing in the images is host-specific — any Docker host (in-house, AWS, a PaaS
such as Railway, Kubernetes) works.

| Component | Image | Doc |
|---|---|---|
| Web app (static SPA behind nginx) | root `Dockerfile` | [web.md](web.md) |
| Regs API + staff console (Fastify) | `server/Dockerfile` | [regs-api.md](regs-api.md) |
| Postgres 16+ (regs system of record, tabular — no PostGIS needed) | stock `postgres` | [regs-api.md](regs-api.md), [db-backup-restore.md](db-backup-restore.md) |

The mobile app is **not a deployed service** — it is the same web build wrapped
in Capacitor; see [../mobile/](../mobile/README.md).

For how the regs API, database, and staff console fit together — and the
Railway/FWP-access handover — see [../regs-manager/](../regs-manager/README.md).

## Runbooks

- [web.md](web.md) — building and serving the web image; build-time
  environment variables (API base URL is baked at build); security headers.
- [regs-api.md](regs-api.md) — the regs API container, required environment,
  boot sequence (migrate → seed → serve), loading data, and
  platform-specific gotchas (including Railway).
- [data-refresh.md](data-refresh.md) — refreshing the bundled regs snapshot
  and regenerating reference datasets per release.
- [db-backup-restore.md](db-backup-restore.md) — `npm run db:backup` and the
  restore rehearsal for the regs database.

## Local parity stack

The whole production topology runs locally with one command — this is also the
portability proof:

```bash
npm run stack:up      # docker compose up --build
# web → http://localhost:8088    api → http://localhost:8080/api/v1/healthz
npm run stack:down
```

`docker-compose.yml` at the repo root wires the exact production images against
a stock `postgres:16-alpine`. The API's boot path is fully offline; outbound
network is needed only for the optional district-code ETL sync.

## The one cross-service coupling to plan for

The web bundle **bakes the regs API base URL at build time** (Vite inlines
`VITE_FWP_API_*` variables into the JS). The API's public host must therefore be
known when you build the web image — set it once via the `VITE_FWP_API_BASE`
build arg. The Docker build then injects that origin into the web CSP
`connect-src` **automatically**, so the app and the browser CSP always agree —
no separate CSP edit. If you move or rename the API host, change the build arg,
rebuild, and redeploy the web image. Details in [web.md](web.md).
