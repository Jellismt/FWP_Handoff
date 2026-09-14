# Development workflow

How to set up, verify, test, and extend Engage MT. Architecture context:
[architecture.md](architecture.md). Per-domain conventions:
[rules/](rules/).

## Prerequisites

- **Node 20+** (the container images build on Node 22) and npm 10+
- **Docker** — only for the full-stack parity run or the regs API without your
  own Postgres
- **macOS + Xcode / Android SDK** — only for mobile builds
  ([mobile/building.md](mobile/building.md); `npm run mobile:bootstrap`
  installs the toolchain)

## Setup and dev servers

```bash
npm install                                      # root — installs all workspaces

npm run dev                                      # web SPA → http://localhost:5173
npm run stack:up                                 # web + regs API + Postgres (Docker)
cd server && DATABASE_URL=... npm run dev        # regs API alone → :8080
npm run dev --workspace @engage-mt/regs-staff    # staff console → :5174 (proxies /api → :8080)
```

The web app runs standalone with no API: regulations fall back to the bundled
snapshot, and all reference data is served from `web/public/data/`.

## The verify gate

```bash
npm run verify        # from the repo root — the mandatory pre-merge gate
```

Fail-fast, in order:

| Step | What it does |
|---|---|
| Install | `npm install` across workspaces |
| Lint | ESLint (`--max-warnings=0`) + Stylelint + Prettier check + imperial-units check |
| Type-check | `tsc -b --noEmit` |
| Tests | vitest with coverage — floors in `web/vitest.config.ts` are hard; then server, shared, staff, and mobile suites |
| Server database tests | `server/test/integration` (RBAC, edit locks, publish, audit rows) against a throwaway Postgres — runs when a Docker daemon or `TEST_DATABASE_URL` is available, otherwise prints a loud SKIP (the gate then reports "passed with skips") |
| Build | production Vite build (4 GB Node heap for the ArcGIS bundle) |

…then the static audit checks:

| Check | Guards against |
|---|---|
| `check:bundle` | Bundle-size budget regressions (app entry chunk, ArcGIS vendor chunk, and total JS, gzipped) |
| `check:calcite-assets` | A Calcite icon used in `web/src` that is not in the shipped allowlist (`web/calcite-assets.allowlist.json`) |
| `check:manifest` | `data-manifest.json` entries missing `effectiveDate` / `source` / schema metadata |
| `check:csp-allowlist` | Drift between code's external hosts and the CSP `connect-src` |
| `check:security-headers` | nginx ↔ dev-server security-header divergence (CSP, HSTS, etc.) |
| `check:ios-privacy-manifest` | Missing/invalid Apple privacy manifest |
| `check:stubs` | Stub registry ↔ `docs/stubs/STUB-NNN.md` contract drift |
| `check:data-freshness` | Bundled datasets whose integrity hash / freshness metadata is wrong |
| `check:regs-floor` | The built-in offline regulations copy is missing, older than 90 days, or past its season |
| `check:container-config` | A Dockerfile lost its `HEALTHCHECK` or non-root `USER`, a compose service has no health probe, or an image's probe path drifted from `railway.json` |
| `check:doc-links` | Broken relative links in markdown docs |
| `check:capacitor-imports` | `@capacitor/*` import forms the WebView can't resolve |
| `check:plugin-parity` | Capacitor plugin version drift between `web/` and `mobile/` |
| `check:native-config` | App id / version / signing config drift in the native projects |
| `check:gis-registry` | Web layer registry drifting from `shared/src/arcgisLayers.ts` |
| `check:montana-scoping` | National layers with no declared Montana-scoping strategy |

A final `npm audit --audit-level=moderate` is a hard step: fix findings by
bumping the dependency, never by allow-listing. Any `check:*` can also be
run individually from the root (see root `package.json` and `web/package.json`).

```bash
npm run verify:e2e    # opt-in: Playwright e2e + axe accessibility (real Chromium, needs network)
```

## Continuous integration

There are no vendor workflow files in this repo. The gate is the same script
everywhere: `bash scripts/ci.sh` runs `verify`, then `verify:e2e`, then a
`gitleaks` secret scan when the binary is installed. Wire it into whichever
runner FWP uses:

1. Check out the repo; use Node 20+ (the container images build on Node 22).
2. `npm ci`
3. `cd web && npx playwright install --with-deps chromium && cd ..`
4. Provide a Postgres for the server database tests — either a Docker daemon
   (the script starts a throwaway container) or `TEST_DATABASE_URL` pointing at
   an empty database such as `postgres://postgres:postgres@localhost:5432/regs_test`.
5. `bash scripts/ci.sh` (`--no-e2e` to skip the browser suite).

Artifacts worth keeping: `web/coverage/`, `web/playwright-report/`. No secrets
are needed. Under `ci.sh` a missing Postgres fails the run rather than skipping
the database tests.

## Testing patterns

Full conventions: [rules/testing.md](rules/testing.md). The essentials:

- **Co-located tests** — `Foo.tsx` → `Foo.test.tsx` in the same directory;
  `X.behavior.test.tsx` for integration-flavored suites.
- **Mock the data hook, not the network.** Component suites mock
  `useFetchJson` / the regs hooks and assert on rendered output
  — no flaky network mocks.
- **Stub heavy children.** When a page composes a map or chart, stub the child
  and assert on the props contract, not the pixels.
- **Coverage floors ratchet up only.** When coverage rises, raise the floors in
  `web/vitest.config.ts` in the same commit. Never lower one to get green.
- **A11y layers:** eslint-plugin-jsx-a11y (static) → unit axe smoke
  (`web/src/test/a11y-smoke.test.tsx`) → dev-time `@axe-core/react` → the
  Playwright axe sweep in `verify:e2e`.

## How to add a map layer

1. **Decide ownership** — which tab owns it, which tabs back-reference it:
   [rules/ia.md](rules/ia.md).
2. **Add a `LayerDef`** to `web/src/config/layers.ts` — stable kebab-case id,
   module, title, service URL, `defaultVisible`, freshness category, source
   attribution. Never inline a service URL in a component.
3. **Montana scoping (mandatory for national services):** declare one of
   `definitionExpression` (server-side state filter — cheapest; verify the
   field name against the live service first), `montanaClip: 'feature'`
   (GPU-side clip for vector layers with no state field), or
   `montanaScopeNote` (documented reason it's bounded another way).
   `npm run check:montana-scoping` fails the build otherwise.
   Details: [rules/arcgis.md](rules/arcgis.md).
4. **Symbology** — renderers are derived in `web/src/components/map/symbology/`
   from brand tokens, not ad-hoc hex.
5. If users will tap it, add a feature card (next section); otherwise the
   generic attribute card renders as the fallback.

## How to add a feature card

1. Create `web/src/components/map/featureCards/cards/<Name>Card.tsx`.
2. Compose the body from the primitives in `core/cardPrimitives.tsx`
   (`HeroBlock`, `MetricPill`, `ChipRow`, `TipBlock`, …) — scan the primitive
   library before writing bespoke JSX; see
   [rules/feature-cards.md](rules/feature-cards.md).
3. Register it:

   ```ts
   import { registerFeature } from "../core/registry";

   registerFeature("layer-id-from-registry", {
     summary: (attrs) => attrStr(attrs, ["NAME", "Name"], "Untitled"),
     Body,
   });
   ```

4. Add the side-effect import to `featureCards/index.ts` so registration runs
   at module load.
5. The cross-renderer conformance suites in `featureCards/core/`
   (`registry.coverage.test.ts`, `renderers.conformance.test.tsx`) assert every
   registered layer resolves and every card meets the design contract — run
   `npm test --workspace web` and satisfy them.

Renderers must be partial-data tolerant: ArcGIS attributes arrive as
`Record<string, unknown>` with inconsistent casing — narrow with the shared
helpers in `web/src/utils/arcgisAttrs.ts`, never crash on a missing field.

## How to add a reference dataset

Reference data is plain JSON behind the manifest — no query engine, and by
convention no static TS data modules in `web/src` (reference data lives in
`public/data/` + the manifest).

1. Add the curated source under `scripts/build-data/sources/` and a
   `build_<dataset>.mjs` builder (wired into `build_all.mjs`).
2. Run `npm run build:data` from `web/` — it emits
   `web/public/data/<dataset>-YYYY.json` and regenerates
   `data-manifest.json` (with `effectiveDate`, `source`, `schemaVersion`, and
   an integrity hash).
3. Consume via a typed loader in `web/src/services/data/` (URL constant +
   in-memory filtering) fetched lazily with `useFetchJson`; pass the dataset's
   `effectiveDate`/`source` to `<FreshnessChip>`. See `services/data/districtFacts.ts`.
4. Commit the regenerated JSON + manifest together. `check:manifest` and
   `check:data-freshness` gate the result.

Regulations data is different — it lives in Postgres and is served by the API;
see [deploy/data-refresh.md](deploy/data-refresh.md) for refreshing its bundled
offline snapshot.

## Style and UI conventions (the short list)

- Design tokens only: `--fwp-*` custom properties from
  `web/src/styles/brand-tokens.css`; no hardcoded hex or font sizes
  (Stylelint-enforced). [rules/fwp-brand.md](rules/fwp-brand.md)
- Async surfaces compose `AsyncBoundary` + skeleton + empty/error cards —
  never bare "Loading…" text. [rules/design-polish.md](rules/design-polish.md)
- Calcite first for UI primitives; register Calcite once in `main.tsx`.
  [rules/calcite.md](rules/calcite.md)
- Touch targets ≥ 44×44 px; all animation gated on
  `prefers-reduced-motion`. [rules/accessibility.md](rules/accessibility.md)
- `@capacitor/*` imports only inside guarded service modules — never bare in
  components. [rules/mobile.md](rules/mobile.md)

---

Licensed under the MIT License.
