# Engage MT documentation

The documentation tree. For a role-based "where do I start?" see the master key
at [../DOCS.md](../DOCS.md).

## Core guides

| Doc | What's inside |
|---|---|
| [codebase-overview.md](codebase-overview.md) | **Start here** — the five workspaces, how big each is (file/line counts), the test suite at a glance, how to run tests, and the safe change-and-verify loop |
| [architecture.md](architecture.md) | System overview — workspaces, web app structure, map substrate, regs data flow, GIS linkage, privacy architecture |
| [development.md](development.md) | Dev workflow — setup, the `npm run verify` gate, testing patterns, how to extend the app |

## Forward-looking — native migration planning

What it would take to carry Engage MT forward as a native application. These
describe a possible future rather than the current code; read them before any
conversation about rebuilding rather than maintaining.

| Doc | What's inside |
|---|---|
| [SWIFTKOTLIN_NATIVE_MIGRATION_GUIDE.md](SWIFTKOTLIN_NATIVE_MIGRATION_GUIDE.md) | The migration as **two native apps** — iOS in Swift, Android in Kotlin |
| [FLUTTER_MIGRATION_GUIDE.md](FLUTTER_MIGRATION_GUIDE.md) | The same migration as **one Flutter codebase** for both platforms |

Both turn on the same central recommendation: publish a single shared,
pre-styled map service, which shrinks every version of this app.

## Runbooks

| Folder | What's inside |
|---|---|
| [regs-manager/](regs-manager/README.md) | The FWP Regs Manager — the regulations app, its API, its database, the staff console, and the Railway/access handover |
| [deploy/](deploy/README.md) | Web static deploy (Docker/nginx), regs API, data refresh, DB backup/restore |
| [mobile/](mobile/README.md) | Android/iOS toolchain, debug builds, signed store releases |

## Reference

| Folder | What's inside |
|---|---|
| [rules/](rules/README.md) | Per-domain engineering conventions (ArcGIS, Calcite, feature cards, IA, data layer, mobile, accessibility, privacy, testing, brand, …) |
| [stubs/](stubs/README.md) | Contracts for stubbed FWP endpoints (`STUB-NNN.md`) + the external-call policy |
| [accessibility/](accessibility/README.md) | Section 508 / WCAG conformance statement (VPAT 2.4) |
| [security/](security/README.md) | CSP + anti-abuse posture |

## Conventions

- **Filenames:** `lowercase-kebab.md`, except `STUB-NNN.md` (frozen by a test).
- **Every folder** carries a `README.md` index; add one when you add a folder.
- **Links** are relative and should be kept valid (`npm run check:doc-links`).
