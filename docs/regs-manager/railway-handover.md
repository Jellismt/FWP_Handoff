# Regs Manager — hosting & access handover (Railway)

This is the **non-code** half of the handover: how the Regs Manager runs in
production and how FWP staff are granted access. The application is delivered as
a fresh git repository (single commit, MIT-licensed) plus a **FWP-owned Railway
project** that deploys from it. Everything below is a runbook — no step is baked
into the code.

> The application is portable — it is two stock Docker images plus a stock
> Postgres (see [../deploy/README.md](../deploy/README.md)). Railway is the
> chosen host, not a requirement; the same images run on any Docker host,
> Kubernetes, or another PaaS.

## The delivery, in two artifacts

1. **The git repository** — the code, delivered as a clean single-commit repo
   under the MIT License. FWP hosts it wherever they keep source (a FWP-owned
   GitHub org, GitLab, or internal Git). This is the source of truth Railway
   deploys from.
2. **The Railway project** — a FWP-owned project containing the running
   services + database. It is connected to the git repo so that pushes deploy.

Ownership of both moves to FWP at handover. The delivering developer's job ends
at "the repo is handed over and the project is proven to deploy"; from then on
FWP owns the account, the data, and the access list.

## What runs in the Railway project

Three components (topology detail in [../deploy/regs-api.md](../deploy/regs-api.md)):

| Service | Built from | Serves |
|---|---|---|
| **Web app** | root `Dockerfile` | The public Engage MT SPA (static, behind nginx). |
| **Regs API + staff console** | `server/Dockerfile` (repo root as build context) | Public read API, staff CRUD API, and the staff console SPA. |
| **Postgres** | Railway's managed Postgres (stock 16+) | The regs system of record. |

The API service's start command runs **migrate → seed → serve**, so a fresh
Postgres becomes a working API on first deploy. Point the API service at the
Postgres via `DATABASE_URL` (Railway exposes it as a reference variable).

## Standing up the project

1. **Create the Railway project** under the FWP-owned account/team.
2. **Add a Postgres** database service.
3. **Add the API service** from the git repo, using `server/Dockerfile` with the
   **repo root** as build context. Set its variables:
   - `DATABASE_URL` → reference the Postgres service.
   - `SESSION_SECRET` → a fresh random string (≥16 chars).
   - `SKIP_POSTGIS=1`, `NODE_ENV=production`.
   - `PUBLIC_CORS_ORIGINS` → the web app's public origin(s) (+ the Capacitor
     app origins for mobile).
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` → the first admin (a FWP address;
     password ≥14 chars). Rotate it from the Users screen after first login.
   - Optional `STAFF_IP_ALLOWLIST` → comma-separated IPs and CIDR ranges to pin
     the staff routes to FWP networks (e.g. `203.0.113.0/24`).
   - Set the service **healthcheck path** to `/api/v1/healthz`.
4. **Add the web service** from the git repo (root `Dockerfile`). The web build
   **bakes the API base URL at build time** (`VITE_FWP_API_*`), so set the
   `VITE_FWP_API_BASE` build variable to the API service's public URL (including
   the `/api/v1/fwp` prefix). The build injects that origin into the web CSP
   automatically — no manual CSP edit needed (see [../deploy/web.md](../deploy/web.md)).
5. **Deploy.** Confirm `GET <api>/api/v1/healthz` → `200` and that the staff
   console loads at the API service root.

## Loading the data

An empty schema deploys automatically (migrate + seed). To bring in real
regulation content, either:

- **Restore a database dump** into the Railway Postgres — the normal path when
  moving an existing environment. Use the database's public/proxy connection
  string with `pg_restore`; steps in
  [../deploy/db-backup-restore.md](../deploy/db-backup-restore.md).
- **Rebuild via ETL** — run the `etl:*` loaders against the new database from a
  machine with the source materials (see
  [database.md](database.md#etl-loaders)).

After the first real publish, refresh the web app's bundled offline snapshot per
[../deploy/data-refresh.md](../deploy/data-refresh.md).

## Granting FWP staff access

Two separate access lists — keep both current, and remove people when they
leave:

- **Railway project (ops)** — invite FWP staff by **email** as project members
  in the Railway dashboard. Members can see logs, variables, deploys, and the
  database. Scope this to the people who operate the service; use the least
  privileged Railway role that lets them do their job.
- **Application accounts (editorial)** — this is *not* Railway access. Staff who
  author regulations get **staff-console accounts**, created by an `admin` from
  the Users screen with the appropriate role (`viewer` / `editor` / `approver` /
  `admin` — see [staff-console.md](staff-console.md)). A person can have an
  application account without any Railway access, and vice versa.
- **Git repository** — grant FWP developers access in whatever Git host FWP
  chose, so they can review and push changes that Railway then deploys.

## Ongoing operation checklist

- **Backups**: schedule daily `pg_dump` and store dumps off-host, on top of
  Railway's own snapshots ([../deploy/db-backup-restore.md](../deploy/db-backup-restore.md)).
- **Secrets**: rotate `SESSION_SECRET` and the seed admin password after
  handover; never commit secrets — they live only in Railway variables.
- **Access reviews**: periodically reconcile the Railway member list, the git
  repo collaborators, and the staff-console Users list against current FWP staff.
- **Deploys**: a push to the connected branch redeploys. The API re-runs
  migrate + seed (both idempotent) on every boot, so schema changes ship by
  adding a new migration and pushing.
