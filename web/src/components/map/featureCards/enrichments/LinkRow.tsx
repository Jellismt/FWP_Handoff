/**
 * @file LinkRow.tsx
 * @module engage-mt/map/featureCards
 * @description Shared enrichment primitive — a horizontal pill-button strip
 *              of external/internal links (FWP webpage, PDF map, directions,
 *              etc.). Consolidates the hand-rolled link rows
 *              that were duplicated across FasCard, WmaCard, StateParkCard,
 *              BlmRecCard, UsfsRecCard, and BorRecCard.
 *
 *              Renders nothing when no links are supplied so callers can
 *              compute the list inline without wrapping in a conditional.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-04
 * @updated 2026-07-16
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface LinkRowLink {
  label: string;
  href: string;
  icon?: LucideIcon;
}

export const LinkRow = ({
  links,
  prefix,
  variant = "default",
}: {
  links: readonly (LinkRowLink | null | undefined)[];
  /** Optional ReactNode rendered as the first item in the row — used for
   *  in-house buttons that aren't simple anchors. */
  prefix?: ReactNode;
  /** Button styling. "default" = compact outline pill; "primary" = solid
   *  accent pill matching the card's Expand / Open-detail action. */
  variant?: "default" | "primary";
}): JSX.Element | null => {
  const real = links.filter((l): l is LinkRowLink => Boolean(l && l.href));
  if (real.length === 0 && !prefix) return null;
  const linkClass =
    variant === "primary"
      ? "fwp-pill-button fwp-pill-button--primary"
      : "fwp-pill-button fwp-pill-button--sm";
  return (
    <div className="feature-card__link-row">
      {prefix}
      {real.map(({ label, href, icon: Icon }, i) => (
        <a key={`${label}-${i}`} className={linkClass} href={href} target="_blank" rel="noreferrer">
          {Icon && <Icon size={14} strokeWidth={2.25} aria-hidden />}
          <span className="fwp-pill-button__label">{label}</span>
        </a>
      ))}
    </div>
  );
};
