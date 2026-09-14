/**
 * @file ListCard.tsx
 * @module engage-mt/shared
 * @description Shared list-page card primitive. Replaces
 *              the hand-rolled list-card variations across the list-style
 *              tool pages (Trail Explorer and friends) so
 *              every list reads as one product instead of a dozen.
 *
 *              Different from the popup-internal `ListCard` in
 *              `featureCards/cardPrimitives.tsx` — that one is a
 *              key/value list inside a popup card. THIS one is the
 *              top-level page card that holds a single item.
 *
 *              Layout (top to bottom):
 *                Eyebrow (manager/kind/region/type, optional)
 *                Title row: title + optional badges (top-right)
 *                Meta row: 3–5 fact cells in a flex row
 *                Chips row (optional amenity flags)
 *                Note (single paragraph blurb, optional)
 *                Actions row (PillButton, anchor)
 *
 *              Module accent: a 6px left stripe driven by `data-module`,
 *              matching the header convention. Hover
 *              lift reuses `.fwp-card-lift`. Dark mode honored via
 *              brand tokens. Highlight state (e.g., MiniMap marker tap)
 *              accepts the `is-highlighted` modifier for a brief flash.
 *
 *              Accessibility: each card is an `<article>`. Title is
 *              the only `<h2>` — list pages should render the page
 *              title as `<h1>`. Action buttons preserve their own
 *              focus states via PillButton.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { forwardRef, type ReactNode } from "react";
import type { EngageMtModule } from "@/types/layers";
import "./ListCard.css";

export type ListCardBadgeIntent = "info" | "success" | "warning" | "danger" | "neutral";
export interface ListCardBadge {
  label: string;
  intent?: ListCardBadgeIntent;
}
export interface ListCardMeta {
  /** Short label (e.g., "Sites", "Acres", "Season"). */
  label: string;
  /** Value to display (formatter is caller's responsibility). */
  value: string | number;
  /** Optional small icon prefix. */
  icon?: ReactNode;
}

interface ListCardProps {
  /** Module accent — colors the left stripe + hover ring. Falls back to "shared". */
  module?: EngageMtModule | "shared";
  /** Uppercase eyebrow above the title (e.g., manager badge "USFS · Lolo NF"). */
  eyebrow?: string;
  /** Bold title (`<h2>`). */
  title: string;
  /** Optional badge pills rendered top-right. */
  badges?: ListCardBadge[];
  /** Up to ~5 metric cells (label + value). */
  meta?: ListCardMeta[];
  /** Boolean-style amenity chips (Reservable / Hookups / ADA / etc.). */
  chips?: string[];
  /** Single-paragraph blurb. */
  note?: ReactNode;
  /** Action-row content (PillButton, anchor). */
  actions?: ReactNode;
  /** Pulse + ring when true; used by MiniMap → row scrolling. */
  highlight?: boolean;
  /** Optional inline content (chart slot, sparkline) below the meta + above the note. */
  inline?: ReactNode;
  /** Test hook. */
  "data-testid"?: string;
}

/**
 * Single-item card for list pages. forwardRef so caller pages can
 * `scrollIntoView` the matching card when a MiniMap marker is tapped.
 */
export const ListCard = forwardRef<HTMLElement, ListCardProps>(
  (
    {
      module = "shared",
      eyebrow,
      title,
      badges,
      meta,
      chips,
      note,
      actions,
      inline,
      highlight = false,
      "data-testid": testId,
    },
    ref,
  ) => {
    const classes = ["fwp-list-card", highlight ? "is-highlighted" : "", "fwp-card-lift"]
      .filter(Boolean)
      .join(" ");

    return (
      <article ref={ref} className={classes} data-module={module} data-testid={testId}>
        <header className="fwp-list-card__head">
          <div className="fwp-list-card__title-block">
            {eyebrow ? <span className="fwp-list-card__eyebrow">{eyebrow}</span> : null}
            <h2 className="fwp-list-card__title">{title}</h2>
          </div>
          {badges && badges.length > 0 ? (
            <div className="fwp-list-card__badges">
              {badges.map((b, i) => (
                <span
                  key={`${b.label}-${i}`}
                  className={`fwp-list-card__badge fwp-list-card__badge--${b.intent ?? "neutral"}`}
                >
                  {b.label}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        {meta && meta.length > 0 ? (
          <dl className="fwp-list-card__meta" aria-label="Key facts">
            {meta.map((m, i) => (
              <div key={`${m.label}-${i}`} className="fwp-list-card__meta-cell">
                <dt>
                  {m.icon ? (
                    <span className="fwp-list-card__meta-icon" aria-hidden>
                      {m.icon}
                    </span>
                  ) : null}
                  {m.label}
                </dt>
                <dd>{m.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {inline ? <div className="fwp-list-card__inline">{inline}</div> : null}

        {chips && chips.length > 0 ? (
          <ul className="fwp-list-card__chips" aria-label="Features">
            {chips.map((c) => (
              <li key={c} className="fwp-list-card__chip">
                {c}
              </li>
            ))}
          </ul>
        ) : null}

        {note ? <p className="fwp-list-card__note">{note}</p> : null}

        {actions ? <div className="fwp-list-card__actions">{actions}</div> : null}
      </article>
    );
  },
);
ListCard.displayName = "ListCard";
