# FWP Brand System

All design tokens live as CSS custom properties in
[`web/src/styles/brand-tokens.css`](../../web/src/styles/brand-tokens.css).
Components read **semantic tokens** (`--fwp-bg-surface`, `--fwp-text-primary`,
`--fwp-cta-primary`, …) — never raw color tokens, never inline hex.

## The one thing to understand first: the two-color inverting theme

The entire app is built from **exactly two colors that swap places by theme**:

| | Light mode | Dark mode |
|---|---|---|
| **Surface** (`--fwp-chrome-bg`) | Grey `#B1B3B3` `rgb(177,179,179)` | FWP Blue `#002855` |
| **Ink** (`--fwp-ink`) — the inverse | FWP Blue `#002855` | Grey `#B1B3B3` |

- **Surfaces** — page background, cards, panels, the top/side/bottom chrome
  rails — are all the *one* surface color. In light that's the grey; in dark
  it's the blue.
- **Ink** is the inverse of the surface. **All text, icons, and card outlines
  read `--fwp-ink`.** In light that's the blue (on grey); in dark it's the grey
  (on blue).
- Because surface and ink are the *same two values swapped*, a card can share
  the page's fill and still separate from it via a 1px **ink-colored outline**
  (`--fwp-card-outline` = `--fwp-ink`).
- **Yellow** (`--fwp-yellow` `#FFC72C`) is the single accent, unchanged in both
  themes — CTAs, focus rings, active-state indicators, toggle knobs.

**The whole inversion is driven by two token overrides.** The
`[data-color-scheme="dark"]` block flips *only* `--fwp-chrome-bg`, `--fwp-ink`,
and `--fwp-heading-accent`. Every other surface / text / outline token is
defined as `var(--fwp-chrome-bg)` or `var(--fwp-ink)` in `:root`, so they invert
automatically — CSS `var()` resolves at use-time. **Do not add per-token dark
overrides for surfaces or text; derive from the two roots and it just works.**

```css
/* :root (light default) */
--fwp-chrome-bg: rgb(177, 179, 179);   /* grey  */
--fwp-ink: var(--fwp-blue);            /* blue  */

/* [data-color-scheme="dark"] — the ONLY surface/text flips */
--fwp-chrome-bg: var(--fwp-blue);      /* blue  */
--fwp-ink: rgb(177, 179, 179);         /* grey  */
```

### The core tokens

| Token | Resolves to | Use |
|---|---|---|
| `--fwp-chrome-bg` | grey / blue | The one surface color (chrome rails + all surfaces derive from it) |
| `--fwp-ink` | blue / grey | The inverse — all text, icons, outlines |
| `--fwp-card-outline` | `--fwp-ink` | 1px outline that separates same-fill cards from the page |
| `--fwp-heading-accent` | `--fwp-ink` (light) / `--fwp-yellow` (dark) | Headings + stat numerals. Yellow text fails AA on the light grey, so it falls to ink in light; on the dark blue it becomes gold |
| `--fwp-text-primary` | `--fwp-ink` | Body text |
| `--fwp-text-secondary` | `color-mix(--fwp-ink 88%, --fwp-chrome-bg)` | Captions — pushed close to ink because the grey mid-tone needs it to clear WCAG AA 4.5:1 |
| `--fwp-text-meta-accessible` | `color-mix(--fwp-ink 92%, --fwp-chrome-bg)` | Small meta labels that must clear AA on grey + tinted backgrounds |

### The one exception that deliberately does NOT invert

**Paper insets** (below) — always-light "field notes" surfaces for dense
reference data. Everything else — every card, panel, list, and widget —
follows the two-color rule.

## Raw color tokens (the palette)

Components must **not** read these directly — they exist so the semantic tokens
above have something to point at.

### FWP Blue family — primary brand

| Token | Value | Use |
|---|---|---|
| `--fwp-blue` | `#002855` | FWP Blue — the ink in light / the surface in dark; Fish accent |
| `--fwp-blue-mid` | `#1B3D6B` | Hover / mid-tone |
| `--fwp-blue-light` | `#4A6FA5` | Fish-bright on dark, aux |

### FWP Green family — Access accent + success

| Token | Value | Use |
|---|---|---|
| `--fwp-green-dark` | `#046A38` | FWP Green — Access accent, success, Game Warden districts on the map |
| `--fwp-green-mid` | `#2D8A5F` | Hover |
| `--fwp-green-light` | `#6BAB8B` | Access-bright on dark |

### Accent / status raw colors

| Token | Value | Use |
|---|---|---|
| `--fwp-yellow` | `#FFC72C` | **The one accent** — CTA, focus ring, active indicators, toggle knobs |
| `--fwp-hunt-red` | `#B3252E` | Hunt accent (bright `--fwp-hunt-red-bright` `#D94349` on dark) |
| `--fwp-brown-raw` | `#744F28` | Explore accent |
| `--fwp-manage-grey` | `#2D3748` | Manage accent (bright `--fwp-manage-grey-bright` `#A8B2C1` on dark) |
| `--fwp-orange` | `#E57200` | Warning / advisory (alias `--fwp-amber`); Hunting Districts on the map |
| `--fwp-red` | `#C5283D` | Danger; Waterbody Closures on the map |

### Cool tech grey neutral ramp

`--fwp-neutral-0` `#FFFFFF` · `-50` `#F4F5F7` · `-100` `#ECEEF1` · `-200`
`#DEE1E6` · `-300` `#C2C7D0` · `-500` `#6B7280` · `-700` `#2D3748` · `-900`
`#0F1419`. These back a few fixed-context needs (white label on the yellow CTA,
neutral map fills) — the app chrome itself is the two-color system above, not
this ramp.

### Legacy aliases (retained for back-compat — do not introduce new uses)

`--fwp-gold` → `--fwp-yellow`, `--fwp-sky` → `--fwp-blue-light`, `--fwp-brown` →
`--fwp-brown-raw`, `--fwp-cream` → `--fwp-neutral-50`.

## Semantic surface tokens

In the two-color model these **all resolve to the one surface color**
(`--fwp-chrome-bg`) — grey in light, blue in dark. They stay as distinct named
tokens for readability and so a future theme *could* re-differentiate them, but
today they are intentionally identical:

`--fwp-bg` · `--fwp-bg-page` · `--fwp-surface` · `--fwp-bg-surface` ·
`--fwp-bg-surface-raised` · `--fwp-bg-surface-sunken` · `--fwp-surface-elevated`
· `--fwp-surface-blue` (floating widgets: Layers panel, Info-modal header).

Use `--fwp-bg-surface` for a card/panel and `--fwp-chrome-bg` for a chrome rail;
prefer the semantic name over the raw `--fwp-chrome-bg` in component code.

## CTA + status + interaction

| Token | Value | Use |
|---|---|---|
| `--fwp-cta-primary` | `--fwp-yellow` (both modes) | Primary CTA fill |
| `--fwp-cta-primary-text` | `--fwp-blue` (light) / near-black (dark) | Label on the yellow CTA |
| `--fwp-cta-primary-hover` / `-press` | `#FFD457` / `#E6B226` | CTA states |
| `--fwp-focus` | `--fwp-yellow` | Focus ring |
| `--fwp-success` | `--fwp-green-dark` | Success (green even in dark, warmer shade) |
| `--fwp-warning` | `--fwp-amber` | Warning |
| `--fwp-danger` | `--fwp-red` | Danger |
| `--fwp-warning-text-on-tint` / `--fwp-danger-text-on-tint` | `#8A4500` / `#8D1C2C` | Warning/danger **text** on their own 12% tint — tuned to clear AA where the raw color wouldn't |
| `--fwp-state-selected-bg` / `-border` | yellow tint / `--fwp-yellow` | Selected-row background + accent |
| `--fwp-state-hover-overlay` / `-press-overlay` | subtle ink/light overlay | Hover / press |

The CTA, focus ring, map-tool active state, sidebar selected state, bottom-tab
active state, and toggle knobs all land on **yellow** — that is what visually
ties the app together.

## Module accents

Used mainly for **map symbology** and a few module-scoped accents. Each
brightens ~10–12% in dark mode for AA on the blue surface.

| Module | Token | Light | Dark |
|---|---|---|---|
| **Hunt** | `--fwp-accent-hunt` | `#B3252E` FWP Red | `#D94349` |
| **Fish** | `--fwp-accent-fish` | `#002855` FWP Blue | `--fwp-blue-light` |
| **Explore** | `--fwp-accent-explore` | `#744F28` brown | `#A07A4D` |
| **Access** | `--fwp-accent-access` | `#046A38` FWP Green | `--fwp-yellow` † |
| **Manage** | `--fwp-accent-manage` | `#2D3748` graphite | `#A8B2C1` |

† Access flips green → yellow-gold in dark (the "no prominent green on navy"
rule) — a deliberate hue swap. Set via
[`web/src/config/navigation.ts`](../../web/src/config/navigation.ts).

### Map symbology brand-color overrides

A handful of map layers override their module accent with a specific brand color
so the map reads correctly. These live in **one place** —
`POLYGON_ACCENT_OVERRIDES` in
[`web/src/components/map/symbology/colors.ts`](../../web/src/components/map/symbology/colors.ts)
— which is read by *both* the map renderer and the legend swatch so the two can
never diverge:

| Layer(s) | Color |
|---|---|
| Hunting Districts (`hunting-districts*`) | `--fwp-orange` `#E57200` |
| Game Warden Districts (`warden-districts`) | `--fwp-green-dark` `#046A38` |
| Waterbody Closures (`waterbody-closures`) | `--fwp-red` `#C5283D` (red outline + red cross-hatch) |

When you re-color a layer, add a row here — never in the renderer or the legend
alone.

## Typography

Three FWP brand faces. The licensed fonts are **not bundled**; each token leads
with the real face name (so a machine that has it licensed uses it) and falls
back to the closest widely-installed match.

| Role | Token | Brand face | Fallback lead |
|---|---|---|---|
| **Primary** | `--fwp-font-sans` | **Gotham Narrow** | Avenir Next / Futura / Century Gothic → system sans |
| **Display** | `--fwp-font-display` | **Sanchez Niu** (slab) | Rockwell / Roboto Slab → Georgia |
| **Editorial** | `--fwp-font-serif` | **Mercury Text** | self-hosted **Fraunces** → Georgia |

- **Sans (Gotham Narrow)** is the workhorse: all UI, body, labels, buttons.
- **Display (Sanchez Niu)** carries hero headlines, panel/takeover titles, and
  dominant data numerals (`--fwp-font-display` + `--fwp-weight-display: 600` +
  `font-variant-numeric: tabular-nums`). Don't put it on dense UI text.
- **Serif (Mercury Text)** is for long-form reading only — privacy/legal pages,
  the About lede. It falls back to **Fraunces**, which is **self-hosted** at
  `web/public/fonts/fraunces.woff2` (never CDN-loaded — privacy rule), so the
  editorial voice renders consistently for every user.

### Ramp, weights, spacing

**9-step size ramp** — `--fwp-text-xs` 11px · `-sm` 13px · `-base` 15px · `-md`
16px · `-lg` 18px · `-xl` 22px · `-2xl` 28px · `-3xl` 36px · `-4xl` 48px. Never
introduce a 10th size.

**Weights** — `--fwp-weight-regular` 400 · `-medium` 500 · `-bold` 700 ·
`-display` 600. Headings: bold, `letter-spacing: -0.01em`
(`--fwp-letter-spacing-heading`). Labels: medium uppercase, `letter-spacing:
0.04em` (`--fwp-letter-spacing-label`).

## Every card follows the two-color model

There is no "always-dark widget" tier. Every card, panel, list row, and tile —
`.feature-card`, `.fwp-manage-card`, `.fwp-list-card`, `.fwp-kpi-tile`, the
module-landing hero/tiles, the tool hero — uses the same recipe:

```css
background: var(--fwp-bg-surface);      /* grey light / blue dark */
border: 1px solid var(--fwp-card-outline);  /* inverse ink */
color: var(--fwp-text-primary);         /* inverse ink */
```

Nested chips/badges differentiate by a `var(--fwp-border-subtle)` outline (the
fill is the same surface color), and a module stripe/accent reads the flipping
`var(--fwp-accent-*)` (which brightens in dark automatically). Copy an existing
card's CSS rather than inventing a surface.

## Paper insets (the one always-light exception)

`--fwp-paper` `#F6F4EE` (+ `-sunken` `-line` `-ink` `-ink-muted`) is a warm
parchment surface for dense reference data (tables, fact blocks). Like the night
widgets it does **not** flip — content inside a paper inset must use the fixed
`--fwp-paper-ink*` tokens, never the flipping `--fwp-text-*` semantics. Utility:
`.fwp-paper-inset` in `global.css`.

## Elevation, spacing, radii, motion

- **Shadows (5-step):** `--fwp-shadow-1` resting → `-5` takeover modal.
  Dark-mode opacities drop ~40% so they don't over-darken the navy surface.
- **Spacing (4-pt grid):** `--fwp-space-1` (4px) → `--fwp-space-10` (64px).
  Never inline `2px` / `6px` / `12px`.
- **Radii:** `--fwp-radius-sm` (4) chips · `-md` (8) cards/buttons · `-lg` (12)
  module hero · `-xl` (16) takeover / hero cards · `-pill` (999) chips, badges,
  toggles.
- **Motion:** `--fwp-motion-quick` 120ms (color/focus) · `-base` 180ms (hover) ·
  `-emphasis` 240ms (modal) · `-soft` 280ms (panel/sheet). All animation is
  gated behind `@media (prefers-reduced-motion: no-preference)` per
  [accessibility.md](accessibility.md).

## Cross-cutting utilities (`web/src/styles/global.css`)

- `.fwp-card-lift` — `--fwp-shadow-3` + `translateY(-2px)` on hover
  (reduced-motion-safe).
- `.fwp-paper-inset` — the always-light paper surface.
- `.fwp-sr-only` — visually-hidden screen-reader label.

## Mode default + persistence

App opens in **light mode**. The toggle persists to `localStorage` under
`engage-mt:theme` (`"light"` | `"dark"` | `"system"`); the `useTheme` hook reads
`prefers-color-scheme` when the stored value is `"system"` and stamps
`data-color-scheme` on the document element. Calcite is themed in lockstep via
the `--calcite-color-*` remap in the dark block.

## Don'ts

- **Don't** add per-token dark-mode overrides for surfaces or text — derive from
  `--fwp-chrome-bg` / `--fwp-ink` and inversion is automatic.
- **Don't** hard-code hex outside `brand-tokens.css` (stylelint error). The only
  sanctioned literals are in contexts that can't read CSS vars — ArcGIS graphic
  symbols and the native status-bar color — plus token fallbacks.
- **Don't** read raw color tokens in components — use semantic tokens.
- **Don't** put yellow *text* on a surface (fails AA on both grey and navy) —
  yellow is for fills, indicators, and focus rings. For accent headings use
  `--fwp-heading-accent`.
- **Don't** introduce a new color without adding a token here **and** in
  `brand-tokens.css`; don't add a 10th font-size.
- **Don't** use dashed dividers (they read "draft") — use `1px solid
  var(--fwp-border-subtle)`.
- **Don't** rely on color alone to convey state (a11y rule).
- **Don't** restyle Calcite internals — remap `--calcite-*` tokens instead.
