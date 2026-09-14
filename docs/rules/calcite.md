# Calcite Design System — Engage MT Rules

## Version

Calcite Design System **5.x**, via `@esri/calcite-components` + `@esri/calcite-components-react`.

## Registration (one place only)

Register Calcite once in `web/src/main.tsx`. Assets are **self-hosted** (copied to `web/public/calcite-assets/` at build time) rather than CDN-loaded — no Calcite request leaves our origin, per [docs/rules/privacy.md](privacy.md):

```ts
import { setAssetPath } from "@esri/calcite-components/dist/components";
import { defineCustomElements } from "@esri/calcite-components/dist/loader";

setAssetPath("/calcite-assets/");
defineCustomElements(window);
```

Never call `defineCustomElements` from a component — it triggers redundant define-calls and console warnings.

## Calcite first, custom second

Default to Calcite for: buttons, inputs, selects, panels, sheets, lists, accordions, tabs, navigation, dialogs, notices, chips, tooltips, popovers, action bars, tile selects, segmented controls, color pickers.

Build custom when: brand expression demands it (the FWP wordmark, hero illustrations, the map shell), or Calcite genuinely doesn't ship it (TBD per case).

## Theming

Calcite reads `--calcite-*` custom properties. We map FWP brand tokens onto Calcite tokens in `web/src/styles/brand-tokens.css` (the `--calcite-*` remap block lives alongside the `--fwp-*` token definitions):

```css
:root {
  --calcite-color-brand: var(--fwp-green-dark);
  --calcite-color-brand-hover: var(--fwp-green-mid);
  --calcite-color-brand-press: var(--fwp-green-light);
  --calcite-color-focus: var(--fwp-gold);
  --calcite-color-background: var(--fwp-cream);
  --calcite-font-family: var(--fwp-font-sans);
}
```

Dark mode flips via `<body color-scheme="dark">` plus Calcite's `<calcite-mode-dark>` wrapper.

## React wrappers

Use `@esri/calcite-components-react`:

```tsx
import { CalciteButton, CalcitePanel } from "@esri/calcite-components-react";
```

These are typed React wrappers around the web components — give us proper `onCalciteButtonClick` etc. event types.

## Slot conventions

When a Calcite component takes slotted content (e.g. `<calcite-panel>`'s `header-actions-end`), name it explicitly:

```tsx
<CalcitePanel heading="Layers">
  <calcite-action slot="header-actions-end" icon="x" label="Close" />
  {/* default-slot content */}
</CalcitePanel>
```

## Do not restyle

Don't reach into Calcite shadow roots. Don't write `calcite-button::part(...)` overrides without documenting in a comment. If you need a visual that Calcite can't deliver via tokens, propose a brand component instead and document in an ADR.

## A11y baseline

Calcite components are accessible by default. Custom components must match: see [docs/rules/accessibility.md](accessibility.md). Always pass `label` on `<calcite-action>` and `<calcite-button icon-start>`.

## Touch targets

Calcite's `medium` scale meets the 44×44 floor. Don't use `scale="s"` on mobile-primary controls without a documented reason.

## Icons ship from an allowlist

Calcite's full icon set is 18 MB; the app ships only the icons named in
`web/calcite-assets.allowlist.json` (all sizes and filled variants), copied at
`postinstall` by `web/scripts/copy-calcite-assets.mjs`. When you use a new
Calcite icon, add its kebab-case name to the allowlist — `npm run verify`
(`check:calcite-assets`) fails on any icon literal in `web/src` that is not
listed, and the copy step fails on a listed name that has no asset file.
