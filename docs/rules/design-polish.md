# Design Polish — Engage MT Rules

The standing UI rules. If you're touching UI, internalize these — the lint guardrails enforce most of them.

## Imports: deep imports are canonical; barrels are the exception

Import a module by its full bucketed path (`@/components/shared/feedback/AsyncBoundary`, `@/store/map/mapStore`) — never through a convenience re-export. `index.ts` barrels are allowed in exactly two cases:

1. **Side-effect registries** — `featureCards/index.ts`, `map/symbology/index.ts` — where importing the barrel IS the point (it runs the registrations).
2. **Self-contained widget folders** — `shared/charts/` — where the folder is one cohesive component with internals nobody imports directly.

Don't add new convenience barrels and don't add re-export shims for moved files: they create import cycles, break tree-shaking, and make "who uses this?" greps lie. When a file moves, repoint every caller.

## State patterns: always three primitives, never bare text

Every async surface composes the same three primitives via `<AsyncBoundary>`:

```tsx
import { useAsyncState } from "@/hooks/useAsyncState";
import { AsyncBoundary } from "@/components/shared/feedback/AsyncBoundary";
import { EmptyStateCard } from "@/components/shared/feedback/EmptyStateCard";

const { state, retry } = useAsyncState({ fetcher, isEmpty, deps });

<AsyncBoundary
  state={state}
  retry={retry}
  subject="trails"
  empty={<EmptyStateCard module="explore" title="..." body="..." />}
>
  {(rows) => /* render data */}
</AsyncBoundary>
```

Don't write:

- `<p>Loading...</p>` — use `<SkeletonGrid />` / `<SkeletonListItem />` / `<SkeletonCard />`.
- `{!loading && !data && <p>No results</p>}` — use `<EmptyStateCard />`.
- `.catch(() => setRows([]))` — wire `<FetchErrorCard />` via `<AsyncBoundary>`.

Don't drift from this rule.

## Filters: one surface

When a page filters a list, opt into the `fwp-control-card` surface (see `styles/global.css` § CONTROL CARD) and build the chip row from `<PillButton>`. Don't hand-roll a flex row of `<button>`s with bespoke pressed-state styling.

## Lists: one primitive

When a page renders a list of feature-style cards (wallet items, trails, contacts), use `<ListCard>`. Don't hand-roll `<li className="my-page__card">` with bespoke head/meta/badge markup.

## Feature-card bodies: primitives first

Before writing JSX in a `registerFeature` body, scan `cardPrimitives.tsx`. See [docs/rules/feature-cards.md § Primitive-first authoring](feature-cards.md) for the table mapping shape → primitive.

## Buttons: three buckets

The button-palette decision:

- `<PillButton>` — default everywhere.
- `<calcite-button>` — only inside Calcite chrome (dialogs, forms, license wizard, map mode toggle).
- Raw `<button>` — only as the internal markup of another primitive (accordion header, card affordance).

## Close buttons: one look, one class

Every "× to close a screen" affordance — modals, dialogs, sheets, galleries — uses
the shared **`.fwp-icon-close`** utility in [global.css](../../web/src/styles/global.css):
a FWP-Yellow circle with the FWP-Blue ×, matching the map tool-rail buttons and the
header CTA pills, at the 44×44 touch floor. The class owns **only the appearance**;
each usage places the `<button class="fwp-icon-close" aria-label="Close …">` inside
its own header/flex row for positioning, with the `<X>` icon from lucide as the
child. Don't hand-roll a bespoke close glyph or restyle a Calcite close action.

For **Calcite dialogs**, whose built-in close lives in an unstyleable shadow-DOM
`calcite-action`: set `closeDisabled` on the dialog (this hides the built-in button
but keeps Calcite's focus-trap + Esc) and slot the `.fwp-icon-close` button into
`header-actions-end`. See `TipMontPortal.tsx` / `TakeoverPopupPortal.tsx`. (Focus
return to the opener for those map-overlay modals is handled explicitly — see
[docs/rules/accessibility.md § Modal & dialog rules](accessibility.md).)

## Token discipline (enforced by stylelint)

- No hardcoded font-size; use `--fwp-text-*` (9-step ramp). `em` allowed for relative scaling.
- No hardcoded hex; use `--fwp-*` semantic or raw tokens. **Enforced as error**.
- No hex fallback inside `var(--fwp-*, #hex)` — `brand-tokens.css` is the single source of truth. **Enforced as error**.
- No `color: white|black` outside `[color-scheme="dark"]` scopes; use `--fwp-text-on-brand`. **Enforced as error**.
- No hardcoded inline-style px (`style={{ marginTop: 12 }}`); use spacing tokens via className.

## Touch targets

Every interactive element honors the 44 × 44 floor. Decorative 28px / 32px visual sizes are fine — wrap the hit area, don't shrink the touch target. Pattern in `AppHeader.css` `.app-header__signin--icon` (visual halo via `::before`).

## Dark mode

Every new component must render correctly in dark mode at design time, not as an afterthought. `color: white` is the canonical smell — stylelint will warn you.

## Reduced motion

All `transition:` / `@keyframes` consumers wrap in `@media (prefers-reduced-motion: no-preference)`. Per [docs/rules/accessibility.md](accessibility.md).

## How the rules get enforced

- `npm run lint` runs ESLint + Stylelint. ESLint errors fail. Stylelint errors fail; warnings advise.
- `npm run build` runs `tsc -b` + Vite. Fails on TS errors.
- Stylelint config: `web/.stylelintrc.json` — token-strict on font-size, color-hex banned (warning), color:white|black banned (warning).
- The list above doesn't get to grow without a corresponding `docs/rules/*` update.

## When in doubt

Read `cardPrimitives.tsx`. Read `Skeleton.tsx`. Read `EmptyStateCard.tsx`. Read `FilterBar.tsx`. Read `ListCard.tsx`. The primitive almost certainly exists.
