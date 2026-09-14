# `web/src/` — orientation

New to the codebase? This is the map. The one-paragraph version: **Engage MT is
a React 19 + Vite app whose universal surface is an ArcGIS map**; three tabs
(Hunt / Explore & Access / My FWP) over five internal module ids ride on top of it, all UI composes
from a small set of shared primitives, and every convention here is enforced by
a gate in `npm run verify`. Project-wide context lives in
[docs/development.md](../../docs/development.md); per-topic rules live in
[docs/rules/](../../docs/rules/).

## Directory map

| Directory              | What lives here                                                                                                                                                                                       | Start with                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `components/`          | All React UI, grouped by module (`hunt/ fish/ explore/ access/ manage/`), plus `map/` (the substrate), `shared/` (cross-module primitives, bucketed), `field/` (field tools), `dev/` (DEV-only pages) | [components/README.md](components/README.md)             |
| `hooks/`               | Every custom hook (`use*`)                                                                                                                                                                            | [hooks/README.md](hooks/README.md)                       |
| `store/`               | Zustand stores, grouped `map/ field/ app/ account/` + persistence plumbing at the root                                                                                                                | [store/README.md](store/README.md)                       |
| `services/`            | Non-React logic: data fetching, domain math, platform bridges — grouped by domain                                                                                                                     | [services/README.md](services/README.md)                 |
| `config/`              | Registries: `layers.ts` (every map layer), `navigation.ts`, symbology, brand-colors mirror                                                                                                            | `config/layers.ts`                                       |
| `data/`                | Bundled reference data + generated indexes (build output of `scripts/build-data/`)                                                                                                                    | —                                                        |
| `styles/`              | `brand-tokens.css` (every color/space/type token) + `global.css`                                                                                                                                      | [docs/rules/fwp-brand.md](../../docs/rules/fwp-brand.md) |
| `types/`               | Shared TypeScript types that cross domains (layer defs, module ids)                                                                                                                                   | `types/layers.ts`                                        |
| `utils/`               | Pure helpers — `http.ts` (THE fetch surface), `arcgisAttrs.ts`, `esriCast.ts`, `capacitor.ts` (platform predicates), formatting                                                                       | —                                                        |
| `copy/`                | Centralized user-facing strings (voice, tooltips, errors)                                                                                                                                             | —                                                        |
| `test/`                | Shared test infra only (setup, fixtures, axe helper) — tests themselves are co-located                                                                                                                | [docs/rules/testing.md](../../docs/rules/testing.md)     |
| `App.tsx` / `main.tsx` | Shell + boot                                                                                                                                                                                          | —                                                        |

## "Where do I put X?"

| I'm adding…                      | It goes in                                                                                                                   | Rule to read first                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| A page/component for one module  | `components/<module>/`                                                                                                       | [ia.md](../../docs/rules/ia.md) (ownership table)     |
| A cross-module UI primitive      | `components/shared/<bucket>/` — layout / feedback / overlays / notices / forms / search / widgets / pages / charts           | [design-polish.md](../../docs/rules/design-polish.md) |
| A map popup for a layer          | `components/map/featureCards/cards/` via the registry                                                                        | [feature-cards.md](../../docs/rules/feature-cards.md) |
| A map layer                      | a `LayerDef` in `config/layers.ts` — never a URL in a component                                                              | [arcgis.md](../../docs/rules/arcgis.md)               |
| Client state                     | an existing store in `store/<domain>/`, or a new `<thing>Store.ts` there                                                     | [store/README.md](store/README.md)                    |
| A data fetch                     | a service under `services/<domain>/`, through `utils/http.ts` (`fetchJson`/`fetchText`/`withBackoff`) — never bare `fetch()` | [data-layer.md](../../docs/rules/data-layer.md)       |
| Tabular/versioned data           | a bundled `/data/*.json` dataset + a manifest entry (read via `useFetchJson` through a `services/data/` loader) — never a static TS data module | [data-layer.md](../../docs/rules/data-layer.md)       |
| An FWP-authenticated endpoint    | a `.stub.ts` under `services/stubs/` + a `STUB-NNN` contract doc                                                             | [data-stubs.md](../../docs/rules/data-stubs.md)       |
| Anything touching `@capacitor/*` | a guarded service (`isCapacitor()` / capability predicate) — never a bare import in a component                              | [mobile.md](../../docs/rules/mobile.md)               |
| A test                           | co-located next to its subject as `<name>.test.ts(x)`                                                                        | [testing.md](../../docs/rules/testing.md)             |

## Three habits that keep this codebase coherent

1. **Primitives first.** Before writing JSX or CSS, check `shared/` and
   `featureCards/core/cardPrimitives.tsx` — the thing you need almost certainly
   exists ([design-polish.md](../../docs/rules/design-polish.md)).
2. **Deep imports, no barrels.** Import by full path
   (`@/components/shared/feedback/AsyncBoundary`); `index.ts` only exists for
   side-effect registries and self-contained widgets.
3. **Every file carries the header** (`@file/@module/@description/@updated/…`)
   and `npm run verify` hard-fails on drift
   ([file-headers.md](../../docs/rules/file-headers.md)).
