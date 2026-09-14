/**
 * @file ToolHero.tsx
 * @module engage-mt/shared
 * @description SC-8 — the shared tool-page hero band. Renders the invariant
 *              `fwp-tool-hero` markup (module-accented night-glass band +
 *              display-serif title + lede) that ~50 tool / explorer / static
 *              pages hand-rolled identically. The CSS already lives in
 *              global.css keyed on `.fwp-tool-hero[data-module]` +
 *              `__title`/`__lede`, so this is a pure markup extraction:
 *              byte-identical output, no visual change.
 *
 *              Deliberately narrow: it owns ONLY the invariant pair. Per-page
 *              variation stays with the caller —
 *                - `backLink`: pages wrap their own accent-styled back-link (the
 *                  class names + styling differ per page, e.g.
 *                  `.static-content__back` vs `.hunt-page__back`), so it
 *                  is a passthrough node rendered above the title, never
 *                  normalized.
 *                - `children`: anything trailing the lede inside the band
 *                  (ExplainerNote, freshness chip, actions) is passed through
 *                  unchanged.
 *
 *              a11y: `title` renders as the page `<h1>` (one per route). The
 *              lede is a plain paragraph. Pass a `ReactNode` for either so
 *              inline markup / entities render exactly as authored.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { ReactNode } from "react";
import type { EngageMtModule } from "@/types/layers";

interface ToolHeroProps {
  /** Owning module — drives the accent stripe + glow via `[data-module]`. */
  module: EngageMtModule;
  /** Page `<h1>` content. */
  title: ReactNode;
  /** Optional `id` on the `<h1>` — for pages that wire `aria-labelledby` to it. */
  titleId?: string;
  /** Supporting lede paragraph. */
  lede: ReactNode;
  /**
   * Optional back-link node rendered above the title, inside the band. Pages
   * keep authoring their own (per-page styled) back-link so its appearance is
   * preserved byte-for-byte.
   */
  backLink?: ReactNode;
  /** Optional trailing content inside the band (ExplainerNote, chips, etc.). */
  children?: ReactNode;
}

/**
 * The shared tool-page hero: the `fwp-tool-hero` band with its `data-module`,
 * title, and lede in a fixed element order.
 */
export const ToolHero = ({
  module,
  title,
  titleId,
  lede,
  backLink,
  children,
}: ToolHeroProps): JSX.Element => (
  <div className="fwp-tool-hero" data-module={module}>
    {backLink}
    <h1 id={titleId} className="fwp-tool-hero__title">
      {title}
    </h1>
    <p className="fwp-tool-hero__lede">{lede}</p>
    {children}
  </div>
);
