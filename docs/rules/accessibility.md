# Accessibility — 508 / WCAG 2.1 AA

Engage MT is built for the public by a public agency. **Accessibility is non-negotiable.**

## Standards

- Section 508 (US federal)
- WCAG 2.1 **Level AA** (all success criteria)
- ARIA 1.2 authoring practices

> **Mobile (Capacitor):** the native-shell seams (tab bar, deep links, resume,
> hardware back, VoiceOver/TalkBack) live in
> [docs/rules/mobile-accessibility.md](mobile-accessibility.md). Everything in
> this file applies to the WebView unchanged.

## Per-component checklist

Every component must pass:

- [ ] **Semantic HTML first.** `<button>`, `<nav>`, `<main>`, `<header>` — not `<div role="button">`.
- [ ] **Color contrast** ≥ 4.5:1 for text, ≥ 3:1 for UI components and graphical objects.
- [ ] **Keyboard navigable.** Every interactive element reachable via Tab, operable via Enter/Space, dismissible via Esc.
- [ ] **Visible focus ring** — at least 2px, 3:1 contrast against background. Use `--fwp-gold` as the focus indicator.
- [ ] **ARIA roles + labels** when semantic HTML isn't sufficient. `aria-label` on icon-only buttons, `aria-describedby` for help text, `aria-live` for status regions.
- [ ] **Touch targets ≥ 44×44 CSS pixels** (WCAG 2.5.5 AAA — we adopt as a baseline).
- [ ] **`prefers-reduced-motion`** respected. Wrap transitions in `@media (prefers-reduced-motion: no-preference)`.
- [ ] **Color not the only signal.** Pair color with icons or text for state.
- [ ] **Screen-reader tested** with VoiceOver (macOS/iOS), TalkBack, and NVDA at major milestones, following [docs/accessibility/manual-checks.md](../accessibility/manual-checks.md) and recording the run there.
- [ ] **Reduced data** — large media (map tiles, charts) lazy-load and respect `Save-Data` where feasible.
- [ ] **Form labels explicit.** Every input has an associated `<label>`. Errors use `aria-invalid` + `aria-describedby` pointing to the error message.
- [ ] **Headings hierarchical.** No `<h3>` without an `<h2>`. One `<h1>` per page (route).

## Calcite as the easy path

Calcite components ship a11y by default. **Prefer Calcite** wherever it fits — see [docs/rules/calcite.md](calcite.md). Always pass `label` on icon-only Calcite actions; the component renders it as `aria-label` and as the tooltip.

## Motion: use tokens, never literal ms

All custom transitions MUST reference `var(--fwp-motion-quick)`, `var(--fwp-motion-base)`, or `var(--fwp-motion-emphasis)` — never `transition: ... 200ms ease`. The motion tokens are themselves gated behind `@media (prefers-reduced-motion: no-preference)` in [brand-tokens.css](../../web/src/styles/brand-tokens.css), so respecting them automatically respects the user's reduced-motion preference.

When you genuinely need a motion that isn't in the ramp (rare — explain in a code comment why), wrap the rule in `@media (prefers-reduced-motion: no-preference) { ... }` yourself. If you ever write `transition: <prop> 180ms <easing>` directly, it's a lint smell — replace with the token.

## Focus rings: outset vs inset

- **Outset (`outline-offset: 2px`)** is the default everywhere — chrome elements (buttons, links, tabs, toggles, inputs) where the focus halo sits *outside* the control so the control's visual identity stays clean.
- **Inset (`outline-offset: -2px`)** is reserved for surfaces where an outset ring would be clipped by the parent: modal dialogs, takeover popups, cards inside scrollable lists, the map canvas. The ring sits *inside* the element's bounding box so it's never clipped.
- **Larger outset (`outline-offset: 4px`)** is reserved for the app's brand wordmark area in `AppHeader`, where the surrounding hit zone is meaningfully bigger than the visual text.

The global `:focus-visible { outline: 2px solid var(--fwp-focus); outline-offset: 2px; }` rule in [global.css](../../web/src/styles/global.css) covers most cases. Only override the offset for the inset/larger cases above, and document the reason inline. Per-component duplicates of the outset rule are forbidden.

## Map a11y

Maps are inherently tricky for screen readers. Engage MT's mitigations:

- Layer toggles live in a Calcite list with proper `<calcite-list-item>` semantics — keyboard-navigable independent of the map canvas.
- Tap-to-query results render in a `<calcite-panel>` side sheet with `aria-live="polite"`. The text content is fully reachable by SR users.
- Layer legend has a textual equivalent. Each layer's `LayerDef` carries a `description`, rendered as the SR-only text alongside the visual swatch.
- "Locate me" button is a normal Calcite button with `aria-label="Center map on my location"`.
- Map tool-rail toggles (measure, draw, layer panel) announce their state via `aria-pressed`.

## Modal & dialog rules

Use `<calcite-dialog>` (preferred) or `<calcite-modal>`. Either way:

- Focus moves into the dialog on open.
- Focus is trapped while open.
- Focus returns to the trigger element on close.
- Esc closes the dialog (Calcite handles this).

**Focus-return caveat for dialogs floating over the map.** Calcite's built-in
focus-restore is unreliable for our full-viewport modals (TipMont, the takeover
popup) because the ArcGIS `MapView` underneath **grabs focus for itself** as the
overlay tears down — so Calcite's restore lands on the map surface, not the pill
that opened the dialog. These modals therefore manage focus-return themselves via
[`utils/focusReturn.ts`](../../web/src/utils/focusReturn.ts): the opener calls
`rememberFocusTrigger()` (snapshots `document.activeElement`) and the portal calls
`returnFocusToTrigger()` on the open→false transition, which re-asserts focus
across a double `requestAnimationFrame` so it wins **after** the map's grab. The
same helper backs the non-Calcite `InfoModal` (which otherwise dropped focus to
`<body>` on Esc/backdrop dismiss). WCAG 2.4.3 Focus Order.

## Testing tooling

Four layers, cheapest → most thorough:

1. **ESLint `eslint-plugin-jsx-a11y`** — `error`-level, static, runs in `npm run lint`.
   Catches attribute-level mistakes but is blind to composed ARIA (e.g. a
   `role` on a `<ul>` that orphans its `<li>`s).
2. **Unit axe smoke** — `src/test/a11y-smoke.test.tsx` runs the real axe engine
   over the high-traffic shared primitives via the `expectNoAxeViolations`
   helper (`src/test/axeSmoke.ts`). Runs inside the mandatory `npm run verify`
   unit-test step → **hard gate.** `color-contrast` + `region` are disabled here
   because happy-dom computes no layout; those are covered in layer 4. When you
   add or change a shared primitive, add a smoke case. This layer already caught
   a systemic `<ul role="group"><li>` list-orphan bug across FilterBar /
   HuntingDistrictsBrowser — a set of toggle controls is a
   `role="group"` of buttons, **not** a `<ul>`/`<li>` list; never put a
   composite `role` on a `<ul>` with plain `<li>` children.
3. **Dev-time axe** — `@axe-core/react` logs violations to the console in `npm run dev`.
4. **Browser axe sweep** — `tests/e2e/10-axe-module-roots.spec.ts` (real Chromium,
   real layout → contrast + landmarks) via `npm run verify:e2e`. Pre-release.
- Manual: at every milestone, run a keyboard-only walkthrough and a VoiceOver walkthrough of the changed surfaces.

## Documenting custom components

Any custom (non-Calcite) interactive component gets a short "Accessibility" section in its file header description, e.g.:

```ts
/**
 * @description LayerLegendItem — visual swatch + label. Renders SR-only
 * text equivalent of the symbology so screen-reader users can identify
 * layers without seeing the swatch.
 */
```
