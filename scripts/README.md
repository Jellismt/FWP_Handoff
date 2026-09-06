# `scripts/` — build, data, and quality-gate tooling

Everything here is run through an `npm run …` script (see the root
[`package.json`](../package.json)) or by the verify orchestrator — nothing is
invoked by a hardcoded path from application code. When you add a script, wire
it into a named npm script and, if it's a gate, into `verify-local.sh`.

## Layout

| Path | Role |
|---|---|
| [`verify-local.sh`](verify-local.sh) | **The orchestrator.** Runs the full local quality gate (`npm run verify`) — lint, types, tests, and every `check:*` gate below, in order. This is the single source of truth for "is the tree green." |
| `qc/` | Quality-control **gates + audits** — manifest/stub/GIS/security/scoping/ios-privacy checks, plus the shared `sourceFiles.mjs` helper (repo root + a `web/src` file walk). Most are wired as `check:*` npm scripts and invoked by `verify-local.sh`. |
| `build-data/` | The **data build** — regenerates `web/public/data/*` + `data-manifest.json` from source datasets. Self-contained (`lib/`, `sources/`, own README). Run via `npm run build:data` / `data:regs` / `data:provenance`. |
| root `*.mjs` / `*.ts` | A few gates that predate the `qc/` folder (`check-doc-links`, `check-data-freshness`, `check-native-config`, `check-plugin-parity`, `check-capacitor-imports`, `check-regs-floor-age`) live at the top level. They are functionally peers of the `qc/` gates; the split is historical, not categorical — both are driven by named npm scripts, so location is invisible to callers. |
| `bootstrap-mobile.sh`, `doctor-mobile.sh`, `prune-mobile-assets.mjs` | Mobile toolchain helpers (`npm run mobile:bootstrap` / `mobile:doctor`). |

## Notes for maintainers

- **`qc/sourceFiles.mjs`** is a tiny shared library (repo root + a `web/src`
  directory walk) imported by `check-gis-registry.mjs` and the advisory
  `check-orphans.mjs` — not a gate itself, so it has no npm script.
- **`qc/check-orphans.mjs`** (`npm run check:orphans`) is an advisory dead-code
  walker, run by hand — intentionally not wired into `verify` (dynamic imports
  can fool it, so it needs a human to confirm before deleting anything).
- The root-vs-`qc/` gate split is a known, low-stakes inconsistency. Because
  every gate is reached through a named npm script (never a raw path from app
  code), consolidating the files would be pure churn against a frozen release —
  documented here rather than reshuffled. New gates should go in `qc/`.
- The `verify` gate set is deliberately scoped to **correctness + ship-safety**
  (types, tests+coverage, bundle budget, CSP/security-header parity, data
  manifest/freshness, stub contracts, GIS-registry + Montana-scoping, native/
  mobile config). Authorship-style conventions (file-header banner, async
  pattern, static-data modules) are guidance in `docs/rules/`, not gates, so a
  new team is blocked by bugs rather than process.
