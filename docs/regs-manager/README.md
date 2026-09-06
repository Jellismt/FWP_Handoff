# FWP Regs Manager — dev-team handover

The **Regs Manager** is the tabular system of record for Montana's hunting
regulations, plus the public read API the Engage MT app consumes. It is two of
the monorepo's workspaces:

| Workspace | What it is |
|---|---|
| `server/` | Fastify + Postgres. Serves the **public read API**, the **staff CRUD API**, and (statically) the built staff console. Owns the schema, migrations, seed, and ETL loaders. |
| `staff/` | The internal **staff console** — a React + Vite SPA where FWP staff author, review, and publish regulations. Built and served by the `server/` container at `/`. |
| `shared/` (`@engage-mt/regs-shared`) | Cross-workspace contracts consumed by both — domain types, role ranks, the response envelope, and `arcgisLayers.ts` (the GIS linkage registry). |

One container serves all three surfaces. Postgres is the only external
dependency.

## The core idea

Regulations are **tabular data with no geometry**. The database stores
districts, portions, restricted areas, seasons, license products, fees,
contacts, and editorial content as rows. Where a map needs a shape, the row
carries a **code** that joins to one of FWP's own public ESRI GIS layers — the
canonical link table is [`shared/src/arcgisLayers.ts`](../../shared/src/arcgisLayers.ts).
This is what lets the whole regs database run on a stock Postgres image and
port cleanly to another SQL engine: there is no PostGIS, no geometry column.

## The editorial lifecycle (draft → publish)

Staff edit a **season year** in place as `DRAFT`. Nothing staff type is visible
to the public app until a publish happens. On **publish**, the server validates
the year, flips draft rows to published, and materializes an **immutable
snapshot** (`published_regulations` + the `published_*` tables) stamped with a
version number and the approving user. The public API only ever reads the
latest published snapshot. Mid-year fixes re-publish and bump the version,
flagged as a correction. See [staff-console.md](staff-console.md) for the
human workflow and [database.md](database.md) for the data model.

```
staff edit (DRAFT)  →  validate  →  publish (v1)  →  public API reads snapshot
                                         │
                        mid-year fix  →  publish (v2, is_correction)
```

## What ships where

- **Public read API** — `/api/v1/fwp/*`, `/api/v2/fwp/*`. Consumed by the
  Engage MT web + mobile app (with cached and bundled fallbacks so the app
  works offline).
- **Staff CRUD + auth API** — `/api/v1/staff/*`. Cookie-session authenticated,
  role-gated. Only the staff console calls it.
- **Print** — `/api/v1/staff/season-years/:year/print/*` renders the regulation
  book to PDF, an HTML proof, and an InDesign ICML package.

Full endpoint list: [api.md](api.md).

## This doc set

| Doc | For |
|---|---|
| [api.md](api.md) | The HTTP contract — public read, staff CRUD, auth, print, health. |
| [database.md](database.md) | Schema, the draft/published model, migrations, seed, and the ETL loaders. |
| [staff-console.md](staff-console.md) | The staff SPA — screens, roles, and the edit→review→publish workflow. |
| [railway-handover.md](railway-handover.md) | Standing up the FWP-owned Railway project and granting FWP staff access — the non-code part of the handover. |

Operational runbooks live under [../deploy/](../deploy/README.md):
[regs-api.md](../deploy/regs-api.md) (deploy + environment),
[db-backup-restore.md](../deploy/db-backup-restore.md), and
[data-refresh.md](../deploy/data-refresh.md).

## Running it locally

```bash
# API alone, against your own Postgres:
cd server
DATABASE_URL=postgres://user:pass@host:5432/regs npm run migrate
DATABASE_URL=... npm run seed
DATABASE_URL=... npm run dev            # Fastify → http://localhost:8080

# Staff console (proxies /api to :8080):
npm run dev --workspace @engage-mt/regs-staff   # → http://localhost:5174

# Or the whole production topology at once:
npm run stack:up                         # web + API + Postgres via docker compose
```

Health check: `GET /api/v1/healthz` → `200` (pings the database).
