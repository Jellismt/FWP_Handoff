# Responsive Layouts — Engage MT Rules

The TL;DR rule file for responsive layout behavior; this rule is the working reference.

## Breakpoints (CSS custom properties, set in `brand-tokens.css`)

These live in `brand-tokens.css` (mobile breakpoint tokens + page-root overflow guard):

- `--fwp-bp-phone-sm: 360px` (iPhone SE / small Android floor)
- `--fwp-bp-compact-max: 480px` (optional compact-phone second collapse step)
- `--fwp-bp-mobile-max: 767px`
- `--fwp-bp-tablet-min: 768px` / `--fwp-bp-tablet-max: 1023px`
- `--fwp-bp-desktop-min: 1024px`
- `--fwp-bp-wide-min: 1440px`

`@media` cannot read `var()`, so the tokens document the contract + back
`min()/max()/clamp()` width math, while the queries use the same **literal**
canonical values. **Use ONLY these `@media` widths** — `max-width: 767/480/1023`,
`min-width: 768/1024/1440`. Anything else fails the
`media-feature-name-value-allowed-list` stylelint guard in `web/.stylelintrc.json`.

## Page-root overflow (the silent-clip trap)

`.app-shell__main > * { width: 100%; min-width: 0; }` (App.css) is load-bearing:
page roots use `max-width; margin: 0 auto`, and `auto` side-margins on a flex
item suppress stretch — without `width: 100%` the section sizes to its
max-content and a single long token (a URL, an error string) blows it past the
viewport, where `MAIN`'s `overflow-x: hidden` clips it silently. Don't remove
that rule. For wide tables, wrap in `.fwp-table-scroll` (global.css) so they
scroll inside their card instead of overflowing.

## Touch targets

- Minimum **44 × 44 px** on every interactive element (token: `--fwp-touch-min`).
- On dense chrome (header icons, map tool rail), keep the visual smaller and lift
  the hit area to 44 with a centered `::before` halo — see `.app-header__*` icon
  buttons. Don't shrink the target; wrap it.
- Use the `var(--fwp-touch-min)` token (not a hardcoded `44px`) so targets
  auto-scale to 56px in field mode.
- Calcite `scale="m"` is the default; never `scale="s"` for primary actions on mobile.

## Map presence

- **Always visible** in Hunt / Explore & Access at all breakpoints.
- **De-emphasized** in My FWP: thumbnail at top of content on mobile/tablet; left rail on desktop.

## Panel stacking

| Surface | Mobile | Tablet | Desktop |
|---|---|---|---|
| Layer panel | full-screen sheet, replaces map view | float over map (320px) | float over map (320px); persists by default |
| Tap-query results | bottom sheet (~50vh) | right rail (40%) | right rail (350px) |
| Search results | full-screen overlay | right rail or floating dropdown | floating dropdown under search input |
| Modal dialog | full-screen | centered (640px max) | centered (640px max) |
| Toast / alert | top of viewport | top-right | top-right |

Rule: **only one** primary content panel can be open on mobile. On tablet/desktop, **layer panel + right rail** may coexist; opening a second right-rail context replaces the first.

## Tab bar

- 3 tabs: Hunt / Explore & Access / My FWP (see `MODULE_NAV` in [`web/src/config/navigation.ts`](../../web/src/config/navigation.ts)); they always fill the bar width evenly.
- Mobile + tablet: bottom tab bar (56px tall + `env(safe-area-inset-bottom)`).
- Desktop: left sidebar (220px wide).
- Active tab: per-module accent stripe (3px top-border on mobile, 3px left-border on desktop).

## Header

- Mobile: 56px tall, logo + condensed action pills + wallet/theme.
- Tablet/Desktop: 64px tall, full logo + tagline + wallet/theme.

## Focus order

Skip link → Header → (sidebar on desktop) → Map (with hint to use layer panel for keyboard interactions) → Right rail → Bottom tab bar.

## Safe-area

Use `env(safe-area-inset-*)` for top notch and bottom indicator.

## Do not

- Don't introduce custom breakpoints per component.
- Don't use container queries unless a + refactor demands them — keep layout-level CSS simple.
- Don't write JavaScript responsive logic when CSS suffices.
