# DOCS.md — the master key

**Where every document lives, what it's for, and where to start.** This is the
complete map of the handover documentation. If you read only one file first, make
it [docs/codebase-overview.md](docs/codebase-overview.md).

## How the docs are organized

The documentation sits in three layers, by how close it is to the work:

1. **Root front-door files** — the first thing anyone opens (`README.md`, this
   file, `CONTRIBUTING.md`).
2. **The `docs/` tree** — the real documentation, grouped **one folder per
   audience/concern**, and **every folder carries a `README.md` index**. This
   file routes you into it by role.
3. **In-code `README.md` files** — short "what lives here" notes *inside* the
   source folders (`web/src/…`, `scripts/`, `mobile/`) so a developer finds
   guidance without leaving the code.

`npm run check:doc-links` runs in the verify gate and resolves relative `.md`
and `.html` links under `docs/` and the repo root. Links from READMEs that live
beside the code, and links pointing at source files, are not checked.

## Start here (by role)

| You are… | Start with |
|---|---|
| **New to the project** | [README.md](README.md) → [docs/codebase-overview.md](docs/codebase-overview.md) → [docs/architecture.md](docs/architecture.md) |
| **A web/mobile developer** | [docs/codebase-overview.md](docs/codebase-overview.md) → [docs/development.md](docs/development.md) + the matching [docs/rules/](docs/rules/README.md) files (arcgis, calcite, feature-cards, mobile) |
| **Taking over the Regs Manager** | [docs/regs-manager/README.md](docs/regs-manager/README.md) — the regulations app, API, DB, staff console, and Railway/access handover |
| **Deploying / hosting** | [docs/deploy/README.md](docs/deploy/README.md) — web (Docker/nginx), regs API, data refresh, backup/restore |
| **Building the mobile app** | [docs/mobile/README.md](docs/mobile/README.md) — toolchain, APK/simulator builds, store release |
| **Wiring the FWP integrations** | [docs/stubs/README.md](docs/stubs/README.md) — the stubbed endpoints and their swap contracts |
| **On QA / accessibility** | [docs/rules/accessibility.md](docs/rules/accessibility.md) + [docs/accessibility/README.md](docs/accessibility/README.md) (VPAT) |
| **On security / privacy** | [docs/security/README.md](docs/security/README.md) + [docs/rules/privacy.md](docs/rules/privacy.md) |

---

## 1. Root front-door files

| File | Purpose |
|---|---|
| [README.md](README.md) | The front door — what Engage MT is, the workspace layout, quickstart, the verify gate, links into the docs. |
| **DOCS.md** (this file) | The master key — the complete, organized catalog below. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Coding conventions summary + the `npm run verify` gate. |
| [LICENSE](LICENSE) | MIT License. |
| `.github/PULL_REQUEST_TEMPLATE.md` | The checklist pre-filled on every pull request. |

## 2. `docs/` — core guides (the orientation path)

| Doc | Purpose |
|---|---|
| [docs/README.md](docs/README.md) | Index of the documentation tree. |
| [docs/codebase-overview.md](docs/codebase-overview.md) | **Start here.** The five workspaces, how big each is (file/line counts), the test suite at a glance, how to run the tests, and the safe change-and-verify loop. |
| [docs/architecture.md](docs/architecture.md) | How the system is built — workspaces, web-app structure, the map substrate, the regs data flow, GIS linkage, privacy architecture. |
| [docs/development.md](docs/development.md) | Dev workflow — setup, the verify-gate table, testing patterns, and step-by-step recipes (add a map layer / feature card / dataset). |

## 3. `docs/rules/` — per-domain engineering conventions

One file per area; read the matching one before working in that surface. Indexed
by [docs/rules/README.md](docs/rules/README.md).

| Theme | Files | Covers |
|---|---|---|
| Accessibility | `accessibility.md`, `mobile-accessibility.md` | WCAG / 508 for web and the native shell. |
| Map & UI | `arcgis.md`, `calcite.md`, `feature-cards.md`, `fwp-brand.md`, `design-polish.md`, `responsive-layouts.md` | ArcGIS SDK usage, Calcite components, the popup/card registry, brand tokens, UI polish, breakpoints. |
| Information architecture | `ia.md` | The module map / where a feature belongs. |
| Data | `data-layer.md`, `data-freshness.md`, `data-stubs.md` | Dataset patterns, the freshness contract, the stub convention. |
| Platform & policy | `mobile.md`, `privacy.md`, `notifications.md`, `testing.md`, `file-headers.md` | Capacitor rules, the privacy mission rule, notice patterns, test conventions, the (optional) header convention. |

## 4. `docs/regs-manager/` — the regulations backend handover

| Doc | Purpose |
|---|---|
| [README.md](docs/regs-manager/README.md) | Index for the Regs Manager handover. |
| `api.md` | The regs API contract / reference. |
| `database.md` | Postgres schema + data model. |
| `staff-console.md` | Guide to the staff editing app. |
| `railway-handover.md` | Hosting + access handover (Railway). |

## 5. `docs/deploy/` — ops runbooks

| Doc | Purpose |
|---|---|
| [README.md](docs/deploy/README.md) | Runbooks index. |
| `web.md` | Deploy the web app (Docker / nginx). |
| `regs-api.md` | Deploy the regs API. |
| `data-refresh.md` | Refresh the regs snapshot + reference datasets. |
| `db-backup-restore.md` | Database backup & restore. |

## 6. `docs/mobile/` — mobile build & release

[README.md](docs/mobile/README.md) (overview) · `building.md` (debug APK / iOS
simulator) · `store-release.md` (signed store releases — keys, accounts).

## 7. `docs/stubs/` — FWP integration contracts

Frozen contracts for FWP endpoints not yet wired (the license wallet, the
regulation map assets). [README.md](docs/stubs/README.md) indexes them;
`STUB-NNN.md` are the individual contracts (asserted by a test) and
`rate-limit-policy.md` sets the call policy for the swap.

## 8. `docs/accessibility/` & `docs/security/` — compliance & posture

| Doc | Purpose |
|---|---|
| [accessibility/README.md](docs/accessibility/README.md) + `engage-mt-vpat-2.4.md` | Index + the VPAT 2.4 conformance statement. |
| [security/README.md](docs/security/README.md) + `anti-abuse.md`, `known-non-issues.md` | CSP/security index, anti-scraping posture, verified-false + standing security decisions. |

## 9. In-code `README.md` orientation notes

Short "what lives here" guides embedded in the source so devs find them in place:

| Location | Purpose |
|---|---|
| [web/src/README.md](web/src/README.md) | Orientation for the web app source tree ("where does X go?"). |
| `web/src/components/`, `hooks/`, `store/`, `services/` (+ `services/hunt/`, `services/public/`, `services/stubs/`) READMEs | Folder-level guides for each code area. |
| [scripts/README.md](scripts/README.md) | The build / data / quality-gate script layout + which gates are load-bearing. |
| [scripts/build-data/README.md](scripts/build-data/README.md) | The reference-data build pipeline. |
| [mobile/README.md](mobile/README.md) + `PRE-FLIGHT.md`, `NATIVE-ASSETS.md`, `assets/README.md` | Mobile working notes — plugin policy, store-cutover checklist, icon/splash masters. |

## Conventions

- **Filenames:** `lowercase-kebab.md`, except intentional IDs: `STUB-NNN.md`
  (stub contracts — frozen, asserted by a test).
- **Every folder** carries a `README.md` index; add one when you add a folder.
- **Links** are relative; keep them valid (`npm run check:doc-links`).
- **Dates** are ISO `YYYY-MM-DD`.

---

Licensed under the MIT License.
