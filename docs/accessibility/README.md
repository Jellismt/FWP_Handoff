# Accessibility

Section 508 / WCAG 2.1 AA conformance documentation for Engage MT.

| File | What it covers |
|---|---|
| [engage-mt-vpat-2.4.md](engage-mt-vpat-2.4.md) | VPAT® 2.4 Accessibility Conformance Report (ACR) — criterion-by-criterion status |
| [manual-checks.md](manual-checks.md) | Screen-reader walkthrough scripts (VoiceOver macOS/iOS, TalkBack, NVDA) and the record of runs |

**Related:**
- Charter + authoring rules: [docs/rules/accessibility.md](../../docs/rules/accessibility.md), [docs/rules/mobile-accessibility.md](../../docs/rules/mobile-accessibility.md)
- The keyboard walk is automated (`tests/e2e/08-keyboard-navigation.spec.ts`). The screen-reader scripts exist in [manual-checks.md](manual-checks.md); FWP records each run in its results table before a release, and the VPAT reports criterion status from those records.
