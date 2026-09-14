# Testing — Engage MT Rules

The conventions the vitest suite (~1,440 unit/component cases) actually follows.
For the suite's size + the full command list, see
[../codebase-overview.md](../codebase-overview.md).

## Where tests live

- **Co-located, always.** `Foo.tsx` → `Foo.test.tsx` in the same directory.
  No `__tests__/` folders.
- **`web/src/test/` is infra only** — `setup.ts` (vitest setup),
  `fixtures.ts` (shared fixture builders), `axeSmoke.ts`
  (`expectNoAxeViolations` helper), and the `a11y-smoke.test.tsx` suite that
  runs real axe over the shared primitives. Don't add feature tests here.

## File-name vocabulary

| Pattern | Meaning |
|---|---|
| `X.test.ts(x)` | Default unit/component suite for `X` |
| `X.behavior.test.ts(x)` | Integration-flavored: exercises `X` through user-visible behavior (render → interact → assert), usually with realistic fixtures and minimal mocking. Use when the unit suite would over-mock the interesting part. |
| `X.branches.test.tsx` | Branch-coverage sweep for a renderer with many data shapes |
| `registry.coverage.test.ts` / `renderers.conformance.test.tsx` | Cross-cutting conformance: every registered layer has a renderer; every Tier-2 body meets the hero mandate |

## The two workhorse patterns

1. **Mock the data hook, not the network.** Component suites mock
   `useFetchJson` / `useAsyncState`-backed hooks and assert on
   rendered output. (This is how coverage got from 31% → 65% without flaky
   network mocks.)
2. **Stub heavy children.** When a page composes a map or chart, stub the
   child and assert on the props contract, not the pixels.

## Coverage floors ratchet

`web/vitest.config.ts`, `server/vitest.config.ts`, `staff/vitest.config.ts`, and
`shared/vitest.config.ts` carry hard floors (stmts/lines/branch/func). They only
move UP — when a coverage push lands, raise the floors to the new watermark in
the same commit. Never lower a floor to make a suite pass.

## A11y testing layers

Cheapest → most thorough: eslint-plugin-jsx-a11y (static) → unit axe smoke
(`src/test/a11y-smoke.test.tsx` — add a case when you add/change a shared
primitive) → dev-time `@axe-core/react` → the Playwright axe sweep
(`npm run verify:e2e`, real layout → contrast + landmarks). Details:
[accessibility.md](accessibility.md).

## What the gates can't see (test these by hand/reason)

Per the code-review checklist: real-page visuals (dark mode, 375px),
data-shape drift between bundled JSON and the live API (missing fields, NULLs,
numeric strings), Capacitor-only runtime paths, and persisted-store migrations.
