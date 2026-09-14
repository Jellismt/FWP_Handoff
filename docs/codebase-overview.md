# Codebase overview — what's here, how big, how to work in it

A one-page orientation for a developer inheriting Engage MT. It answers three
questions: **what are the pieces, how big is each, and how do I change something
safely?** For the deeper dives it links to [architecture.md](architecture.md)
(how it's built) and [development.md](development.md) (step-by-step recipes).

## The app in one screen

Engage MT is an npm **monorepo** with five workspaces. Three are apps, one is a
server, one is shared glue:

| Piece | Workspace | What it is |
|---|---|---|
| **Engage MT — web** | `web/` | The public map app: React + TypeScript + the ArcGIS Maps SDK. Hunt districts, fishing access, public-land ownership, live river conditions, etc. This is the product. |
| **Engage MT — mobile** | `mobile/` | A thin **Capacitor** wrapper that ships the *same* web build as an iOS/Android app. No separate UI — it's the web app plus native bridges (location, camera, offline tiles). |
| **Regs Manager — staff console** | `staff/` | The internal admin app FWP staff use to author and publish hunting-regulation content. Not public-facing. |
| **Server — DB + API** | `server/` | A Fastify API + PostgreSQL database + ETL loaders. Stores the regulations the staff console edits and serves them to the app. |
| **Shared** | `shared/` | TypeScript types + the ArcGIS layer registry shared by all of the above, so the app, the API, and the staff console agree on one shape. |

The web app runs **standalone with no server**: regulations fall back to a
bundled offline snapshot and all reference data is plain JSON in
`web/public/data/`. The server is only needed for *live* regulation editing.

## How big is it — the core (production source, no tests)

| Piece | Files | Lines |
|---|---:|---:|
| **Engage MT — web** (TS/TSX + CSS) | ~370 | ~51,300 |
| **Engage MT — mobile** (config + native bridges + build scripts) | ~11 | ~1,050 |
| **Regs Manager — staff console** | ~47 | ~6,400 |
| **Server — DB + API** (TS + 28 SQL migrations) | ~90 | ~10,200 |
| **Shared types** | 6 | ~715 |
| **Total (production source)** | **~525** | **~69,700** |

By share of the code: **Engage MT (web+mobile) ≈ 77%**, Server + DB ≈ 13%,
Staff console ≈ 9%, Shared ≈ 1%.

> **Two things this number is NOT.** (1) It excludes tests — those are counted
> separately below. (2) You may see a folder with *thousands* of files
> (`web/public/calcite-assets/`, ~6,800) or a huge `web/dist/` — those are a
> **dependency's assets and the build output**. They're git-ignored, regenerated
> by `npm install` / `npm run build`, and are **not** code anyone maintains.
> Line counts here are raw `wc -l` (comments + blanks included); this codebase is
> heavily header-commented, so real logic is roughly 25–30% lower.

### Where the weight sits

- **Web app** is dominated by two folders: `components/` (~148 files / ~23,500
  lines — the map, the tap-to-open feature-card popups, tool rails, pages) and
  `services/` (~69 files / ~9,550 lines — the data/regs/spatial/mobile logic).
  Everything else (stores, hooks, config, utils, routes) is ~80 files combined.
- **Server** splits fairly evenly: ETL loaders (~2,900 lines), API routes
  (~1,930), services (~1,740), SQL migrations (~1,650), db + auth (~920).

## The test suite at a glance

Tests are kept **on top of** the ~71k core (they're the safety net that lets you
change code and instantly know if you broke something):

| Kind | Count | What it protects |
|---|---:|---|
| **Unit + component tests** (`*.test.ts` / `*.test.tsx`, co-located) | ~1,440 cases in ~215 files / ~24,400 lines across web, server, staff, and shared (plus the build and gate scripts) | Individual functions, hooks, and components render/behave correctly |
| **End-to-end + accessibility** (Playwright, `web/tests/e2e/`) | 11 specs / 16 tests, each run on desktop and phone viewports | The real app in a real browser: map loads, tabs navigate, tap opens a card, theme persists, keyboard walk (skip link, roving tool rail, menu escape), no unexpected console errors, axe finds no a11y violations |
| **Contract / conformance** (part of the unit count) | a handful | Every registered map layer has a renderer; every stub honors its documented contract; the GIS registry matches `shared/` |

Note: the staff console and the mobile wrapper carry contract tests (the API
client, the season store, a render smoke of the shell; the Capacitor config the
native shells depend on). Coverage floors are enforced in the `web`,
`server`, `staff`, and `shared` workspaces. The server's database integration
tests run inside `npm run verify` whenever a Docker daemon (or
`TEST_DATABASE_URL`) is available and are reported as SKIPPED otherwise; its
logic tests run everywhere.

Full conventions (how to name a test, what to mock): [rules/testing.md](rules/testing.md).

## Running the tests & checks

Everything runs from the repo root unless noted.

| Command | What it does |
|---|---|
| `npm run verify` | **The one that matters.** The full pre-merge gate: lint, type-check, all unit tests **with coverage**, production build, then the safety checks (bundle size, CSP, data freshness, GIS registry, Montana-scoping, mobile config, …). If this is green, you're safe to merge. |
| `npm run verify:e2e` | Adds the Playwright end-to-end + accessibility sweep (needs a real browser + network). |
| `npm test` | Just the web unit tests, once (fast — no coverage, no build). |
| `npm run test:watch --workspace web` | Unit tests in **watch mode** — re-runs as you edit. Best while developing. |
| `npm test --workspace web -- FreshnessChip` | Run only the test files matching a name (here, anything with "FreshnessChip"). |
| `npm run test:coverage --workspace web` | Unit tests + an HTML coverage report in `web/coverage/`. |
| `npm run test:server --workspace server` | Server unit + database tests — spins up a throwaway Postgres in Docker, runs, tears it down. (Needs Docker; `verify` does this automatically when Docker is present.) |

## Making a change safely — the loop

For a junior team, this is the whole workflow:

1. **Start the app** — `npm run dev` → http://localhost:5173 (no server needed).
2. **Make your edit.** Match the patterns already in the file; the per-area rules
   in [docs/rules/](rules/README.md) tell you the conventions for that surface
   (map layers, feature cards, data, brand, accessibility, mobile).
3. **Watch the tests** as you go — `npm run test:watch --workspace web`.
4. **Add or update a test** for what you changed. Co-locate it next to the file
   (`Foo.tsx` → `Foo.test.tsx`); mock the data hook, not the network
   ([rules/testing.md](rules/testing.md)).
5. **Run the gate** — `npm run verify` (and `npm run verify:e2e` for UI-visible
   changes). Green means lint, types, every test, the build, and the safety
   checks all pass.
6. **Commit.** Run `npm run format` first if the lint step flagged formatting.

Common "how do I add X?" recipes — a map layer, a feature-card popup, a reference
dataset — are written out step-by-step in
[development.md](development.md#how-to-add-a-map-layer).

### If a check goes red and you're not sure why

Each `check:*` guards one specific thing (see the table in
[development.md](development.md#the-verify-gate)). The message names the file and
the rule. The gate is deliberately scoped to **correctness and ship-safety** —
it won't fail you for stylistic nits, so a red gate almost always means a real
problem (a broken type, a failing test, a dataset whose hash doesn't match, a map
layer that isn't Montana-scoped). Fix the cause; never lower a coverage floor to
turn a suite green.

---

Related: [architecture.md](architecture.md) · [development.md](development.md) ·
[rules/](rules/README.md) · [regs-manager/](regs-manager/README.md) ·
[deploy/](deploy/README.md) · [mobile/](mobile/README.md)

Licensed under the MIT License.
