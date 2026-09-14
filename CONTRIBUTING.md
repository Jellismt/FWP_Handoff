# Contributing to Engage MT

The short version. The long-form conventions live in [docs/rules/](docs/rules/)
— read the rule file for whatever area you're touching before you touch it.

## Local setup

```bash
git clone <repo>
cd engage-mt
npm install        # root install — resolves all five workspaces
npm run dev        # web dev server at http://localhost:5173
```

Full workspace quickstarts (server, staff console, mobile) are in the
[README](README.md#quick-start); the dev workflow is in
[docs/development.md](docs/development.md).

## The one hard gate

**`npm run verify` must pass before any merge.** From the repo root, it runs
lint (ESLint + Stylelint + Prettier), the TypeScript build, the vitest suite
with coverage floors, the production Vite build, and 16 repository audit
checks (`check:*` scripts). Nothing lands red. For UI-heavy changes also run
`npm run verify:e2e` (Playwright end-to-end + axe accessibility sweep). A
hosted runner calls `bash scripts/ci.sh`, which is those two plus a secret scan.

## Coding standards (enforced on every file)

- **Prettier formatting** — no exceptions (`npm run format`).
- **File header** on every `.ts`/`.tsx`/`.css` file under `web/src/` — a
  convention (not gated), template in
  [docs/rules/file-headers.md](docs/rules/file-headers.md). Match the existing
  pattern on new files as a courtesy to the next maintainer.
- **No `any`** in TypeScript; strict null checks are on.
- **No magic numbers** — named constants only.
- **DRY** — extract to hooks/utils/services rather than copy-paste.
- **Comments explain "why," not "what."**
- **No secrets in source** — credentials live in `.env` files (gitignored).

## Accessibility baseline (non-negotiable)

Section 508 / WCAG 2.1 AA. Every interactive element: semantic HTML first,
`aria-label` on icon-only controls, keyboard operability, visible focus ring,
touch targets ≥ 44×44 px, `prefers-reduced-motion` respected, color never the
only signal. Details and the four-layer testing stack (static lint → unit axe
smoke → dev-time axe → Playwright axe sweep):
[docs/rules/accessibility.md](docs/rules/accessibility.md).

## Privacy (mission rule)

No telemetry, no analytics, no third-party CDNs/trackers; user location never
leaves the device. Any contribution violating
[docs/rules/privacy.md](docs/rules/privacy.md) is non-mergeable.

## Testing

- **Co-located tests, always** — `Foo.tsx` → `Foo.test.tsx` in the same
  directory. No `__tests__/` folders.
- Workhorse patterns: **mock the data hook, not the network**, and **stub heavy
  children** (maps, charts) and assert on the props contract.
- **Coverage floors only ratchet up.** `web/vitest.config.ts` carries hard
  floors (statements/lines/branches/functions). When a coverage push lands,
  raise the floors to the new watermark in the same commit. Never lower a floor
  to make a suite pass.
- Full conventions: [docs/rules/testing.md](docs/rules/testing.md).

## Git workflow

- Branches: `feature/<name>`, `fix/<name>`, `chore/<name>`, `docs/<name>`.
- **Conventional Commits**: `feat(map): …`, `fix(hunt): …`, `chore(deps): …`.
  Subject ≤ 72 chars; body explains *why*.
- Squash-merge by default; keep the squash message conventional.

## PR checklist

- [ ] `npm run verify` green from the repo root.
- [ ] Tests added or updated alongside the change (co-located).
- [ ] A11y reviewed (keyboard walkthrough; axe clean).
- [ ] Only `--fwp-*` design tokens — no inline hex, no ad-hoc font sizes
      (see [docs/rules/fwp-brand.md](docs/rules/fwp-brand.md)).
- [ ] No new user-location data leaves the device (privacy rule).
- [ ] File headers present and current on touched files.
- [ ] Docs updated if a convention or contract changed.

## Where the deep rules live

| Area | Rule file |
|---|---|
| ArcGIS / map layers | [docs/rules/arcgis.md](docs/rules/arcgis.md) |
| Calcite components | [docs/rules/calcite.md](docs/rules/calcite.md) |
| Feature cards / popups | [docs/rules/feature-cards.md](docs/rules/feature-cards.md) |
| Module ownership / IA | [docs/rules/ia.md](docs/rules/ia.md) |
| Data layer + freshness | [docs/rules/data-layer.md](docs/rules/data-layer.md), [docs/rules/data-freshness.md](docs/rules/data-freshness.md) |
| Stubs for FWP endpoints | [docs/rules/data-stubs.md](docs/rules/data-stubs.md) |
| Mobile / Capacitor | [docs/rules/mobile.md](docs/rules/mobile.md), [docs/rules/mobile-accessibility.md](docs/rules/mobile-accessibility.md) |
| Brand tokens / typography | [docs/rules/fwp-brand.md](docs/rules/fwp-brand.md) |
| UI polish & state patterns | [docs/rules/design-polish.md](docs/rules/design-polish.md) |
| Responsive layouts | [docs/rules/responsive-layouts.md](docs/rules/responsive-layouts.md) |
| Testing | [docs/rules/testing.md](docs/rules/testing.md) |
| Accessibility | [docs/rules/accessibility.md](docs/rules/accessibility.md) |
| Privacy | [docs/rules/privacy.md](docs/rules/privacy.md) |
| File headers | [docs/rules/file-headers.md](docs/rules/file-headers.md) |

## License

Licensed under the MIT License.
