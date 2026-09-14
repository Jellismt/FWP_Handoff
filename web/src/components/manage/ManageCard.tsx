/**
 * @file ManageCard.tsx
 * @module engage-mt/manage
 * @description Shared card primitive for the Manage section.
 *              Replaces the inconsistent button-dump + custom card shapes
 *              that grew across ManagePage / OfflineTilesPage
 *              with a single accessible "title + description + icon + CTA"
 *              tile. Composes with PillButton + Lucide icons.
 *
 *              The Link variant routes via React Router; the action variant
 *              fires an onClick. Both render the same outer chrome so the
 *              Tools tab + Wallet tab + Settings tab all read consistent.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Link } from "react-router-dom";
import { prefetchProps } from "@/utils/routePrefetch";
import { ChevronRight, type LucideIcon } from "lucide-react";
import "./ManageCard.css";

export interface ManageCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Internal route. Mutually exclusive with `href` + `onClick`. */
  to?: string;
  /** External URL — opens in a new tab. */
  href?: string;
  /** Imperative click handler. */
  onClick?: () => void;
  /** Optional badge text shown next to title (e.g. "DEMO" / "BETA"). */
  badge?: string;
  /** Optional intent — colors the left edge stripe. */
  intent?: "default" | "primary" | "warning" | "success";
  /** Optional accent override (uses a CSS var). */
  accentVar?: string;
}

const InnerContent = ({
  title,
  description,
  icon: Icon,
  badge,
}: Pick<ManageCardProps, "title" | "description" | "icon" | "badge">): JSX.Element => (
  <>
    {Icon && (
      <span className="fwp-manage-card__icon" aria-hidden>
        <Icon size={20} strokeWidth={2.0} />
      </span>
    )}
    <span className="fwp-manage-card__body">
      <span className="fwp-manage-card__title">
        {title}
        {badge && <span className="fwp-manage-card__badge">{badge}</span>}
      </span>
      {description && <span className="fwp-manage-card__description">{description}</span>}
    </span>
    <ChevronRight size={16} strokeWidth={2.25} aria-hidden className="fwp-manage-card__chevron" />
  </>
);

export const ManageCard = ({
  title,
  description,
  icon,
  to,
  href,
  onClick,
  badge,
  intent = "default",
  accentVar,
}: ManageCardProps): JSX.Element => {
  const className = `fwp-manage-card fwp-manage-card--${intent}`;
  const style = accentVar ? { ["--manage-card-accent" as string]: accentVar } : undefined;

  if (to) {
    return (
      <Link
        to={to}
        className={className}
        style={style}
        aria-label={`${title}${description ? " — " + description : ""}`}
        {...prefetchProps(to)}
      >
        <InnerContent title={title} description={description} icon={icon} badge={badge} />
      </Link>
    );
  }
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
        style={style}
        aria-label={`${title} (opens in a new tab)`}
      >
        <InnerContent title={title} description={description} icon={icon} badge={badge} />
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={style}
      aria-label={`${title}${description ? " — " + description : ""}`}
    >
      <InnerContent title={title} description={description} icon={icon} badge={badge} />
    </button>
  );
};
