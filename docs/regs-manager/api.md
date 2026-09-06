# Regs Manager — API reference

Fastify app, registered under version prefixes in `server/src/app.ts`. Every
response uses the shared envelope from `@engage-mt/regs-shared`: success is
`{ ok: true, data }`, failure is `{ ok: false, errors: [{ code, message }] }`.

| Prefix | Surface | Auth |
|---|---|---|
| `/api/v1` | Health + CMS asset stub | none |
| `/api/v1/fwp` | Public read API (v1) | none (CORS-gated) |
| `/api/v2/fwp` | Public read API (v2) | none (CORS-gated) |
| `/api/v1/staff/auth` | Login / logout / session | cookie session |
| `/api/v1/staff` | Staff CRUD, content, print | cookie session + role |

Cross-cutting: a global **rate limit** (60 req/min/IP in production) and a
**CORS allowlist** (`PUBLIC_CORS_ORIGINS`) wrap the app. The staff surface can
additionally be pinned to a comma-separated list of IPs and CIDR ranges (IPv4/IPv6) via `STAFF_IP_ALLOWLIST`.
Staff sessions expire after 8 hours idle or 7 days absolute; the API sweeps expired rows on boot and hourly.

## Health

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/healthz` | `SELECT 1` against the pool. `200` = DB reachable. Used as the platform healthcheck. |

## Public read API (`/api/v1/fwp`, `/api/v2/fwp`)

Unauthenticated, read-only, and served entirely from the **latest published
snapshot** — never from draft rows. These are the endpoints the Engage MT app
calls.

| Method | Path | Returns |
|---|---|---|
| GET | `/hunting/regulations` | The published regulations, unified per district/species/audience. |
| GET | `/hunting/seasons` | Season windows for the published year. |
| GET | `/hunting/regions` | FWP administrative regions. |
| GET | `/hunting/restricted-areas` | Restricted-area definitions + their district links. |
| GET | `/hunting/district-notes` | Published per-district notes. |
| GET | `/hunting/license-fees` | Published fee schedule. |
| GET | `/hunting/important-dates` | Published season/application dates. |
| GET | `/hunting/contacts` | Published contact directory. |
| GET | `/hunting/content` · `/hunting/content/:slug` | Published editorial content sections. |
| GET | `/hunting/corrections` | Feed of mid-year correction publications. |
| GET | `/hunting/youth-opportunities` | Youth/PTHFV opportunities. |
| GET | `/datasets/hunting-regulations-unified` | The full unified dataset (the shape the app's build-time snapshot is generated from). |

The v2 prefix (`publicV2Routes.ts`) serves the current app; v1 is retained for
compatibility. A leak-guard test (`publicV2Routes.leakguard.test.ts`) asserts
the public surface never exposes draft-only or staff-only fields.

## Auth (`/api/v1/staff/auth`)

Cookie-session auth. The session cookie is signed with `SESSION_SECRET`.

| Method | Path | Notes |
|---|---|---|
| POST | `/login` | Email + password → sets the session cookie. |
| POST | `/logout` | Clears the session (requires auth). |
| GET | `/me` | Current identity + role (requires auth). |
| POST | `/change-password` | Self-service password change (requires auth). |

## Staff CRUD + content (`/api/v1/staff`)

All routes chain `requireAuth` then `requireRole(min)`. Roles are ranked
`viewer < editor < approver < admin` (see [staff-console.md](staff-console.md)).
Reads generally require `viewer`; writes require `editor`; publish requires
`approver`; user administration requires `admin`.

**Season years & publishing**

| Method | Path | Notes |
|---|---|---|
| GET | `/season-years` | List seasons + their status/version. |
| POST | `/season-years` | Create a new season year. |
| POST | `/season-years/:year/clone-from/:prev` | Seed a new year from the prior year's data. |
| GET | `/season-years/:year/validation` | Run publish validation without publishing (blocking + advisory findings). |
| GET | `/season-years/:year/diff` | Diff draft vs the last publish. |
| POST | `/season-years/:year/publish` | Validate → flip → materialize snapshot → record publication (approver). |

**Domain entities** (list/create/update/delete + relationship sub-resources)

| Group | Endpoints |
|---|---|
| Hunt areas | `GET/POST /hunt-areas`, `PATCH/DELETE /hunt-areas/:id`, `GET/PUT /hunt-areas/:id/members`, `POST /hunt-areas/:id/repoint` |
| Portions | `GET/POST /portions`, `PATCH/DELETE /portions/:id` |
| Restricted areas | `GET/POST /restricted-areas`, `PATCH/DELETE /restricted-areas/:id`, `GET/PUT /restricted-areas/:id/districts`, `GET /restricted-areas/:id/districts` |
| Opportunities | `GET/POST /opportunities`, `PATCH /opportunities/:id`, `POST /opportunities/:id/archive`·`/restore`, `PUT /opportunities/:id/windows`·`/restrictions` |
| Instruments | `GET/POST /instruments`, `PATCH/DELETE /instruments/:id` |
| Products & prices | `GET/POST /products`, `PUT /products/:id/prices` |
| Contacts | `GET/POST /contacts`, `PATCH/DELETE /contacts/:id` |
| Important dates | `GET/POST /important-dates`, `PATCH/DELETE /important-dates/:id` |
| District notes | `POST /notes`, `PATCH /notes/:id` |
| Regions | `GET /regions`, `PUT /regions/:regionId/map-asset` |
| Districts | `GET /districts`, `GET /districts/:code/detail` |

**Content sections** (`staffContentRoutes.ts`)

| Method | Path |
|---|---|
| GET | `/content-sections`, `/content-sections/:id` |
| POST | `/content-sections`, `/content-sections/:id/archive`, `/content-sections/:id/restore` |
| PATCH | `/content-sections/:id` |
| GET/POST | `/assets` (CMS asset upload + listing) |

**Reference reads** (populate editor dropdowns): `/animal-classes`,
`/restriction-types`, `/season-years`, `/products`, `/instruments`, `/regions`,
`/publications`.

**Audit log** (any role): `GET /audit-log` with optional `table` (one of the
audited tables), `user` (case-insensitive email), `from` / `to` (ISO 8601,
`to` exclusive), `limit` (1–500, default 100), and `before` (keyset cursor: the
`audit_id` echoed as `meta.nextCursor` on a full page). Rows are newest first.
`GET /audit-log.csv` (approver+) downloads the same filtered rows as a CSV
attachment, capped at 10,000 rows.

**User administration** (`admin`): `GET/POST /users`, `PATCH /users/:id`,
`POST /users/:id/reset-password`.

## Print (`/api/v1/staff/season-years/:year/print`)

Generates the regulation book from the published (or draft) data.

| Method | Path | Content-Type |
|---|---|---|
| GET | `/print/proof.html` | `text/html` — instant browser proof (Print → PDF). |
| GET | `/print/book.pdf` | `application/pdf` — headless-Chromium render at 5.5×8.5. |
| GET | `/print/icml.zip` | `application/zip` — InDesign ICML story package. |

## Edit locks

Concurrent editing is coordinated by advisory **edit locks** (migration `0012`,
helpers in `routes/lockHelpers.ts`): acquiring an entity for edit takes a lock;
stale locks expire. This prevents two editors silently overwriting each other
mid-season.
