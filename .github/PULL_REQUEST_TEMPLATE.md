<!--
Engage MT — PR template.
Long-form rules: CONTRIBUTING.md + docs/rules/ + docs/.
-->

## What changed

-

## Why

<!-- Link to the issue or proposal that motivated this. -->

## Screenshots / demo

<!-- For UI changes. Drop a screenshot for desktop + mobile breakpoints if layout changed. -->

## Checklist

- [ ] `npm run verify` passes (lint · type-check · every workspace's tests · build · audits).
- [ ] `npm run verify:e2e` passes for any UI-visible change.
- [ ] File headers present on every new `.ts`, `.tsx`, `.css`, `.mjs`, `.sh`.
- [ ] Brand tokens only (no hex outside `brand-tokens.css`).
- [ ] Accessibility checked (keyboard walk + screen-reader spot-check on changed surfaces — see `docs/accessibility/`).
- [ ] Docs updated where a rule or contract changed (`docs/rules/`, `docs/deploy/`, `README.md`).

## Privacy gate (non-negotiable)

- [ ] **I verified no new user-location data leaves the device.**
- [ ] No analytics, telemetry, or external error reporting added.
- [ ] No production-shaped tokens introduced anywhere; stubs return clearly-fake fixtures.
- [ ] EXIF / metadata stripped from any new photo-upload path.

## Notes for reviewers

<!-- Anything reviewers should pay extra attention to: tricky regression risk, performance impact, surface area change. -->
