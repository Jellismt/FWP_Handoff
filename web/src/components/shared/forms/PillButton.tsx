/**
 * @file PillButton.tsx
 * @module engage-mt/shared
 * @description Canonical button for Engage MT. Wraps the existing
 *              `.fwp-pill-button` CSS family + adds variant / size /
 *              icon ergonomics + proper accessibility. Replaces every
 *              `<CalciteButton>` + ad-hoc `<button>` in the
 *              FeatureCard registry + module pages so the action row
 *              looks like one product instead of three.
 *
 *              Variants:
 *                - primary    — filled accent CTA ("Open detail")
 *                - secondary  — outlined neutral ("Switch to Hunt")
 *                - ghost      — bare hover-state ("Cancel")
 *                - danger     — filled red ("Delete draft")
 *              Sizes:
 *                - md (default) — 36px min-height (touch-safe)
 *                - sm           — 28px min-height (in-card compact)
 *              Icons:
 *                - `iconStart` / `iconEnd` accept a Lucide component
 *                  reference. Renders at 16px (md) / 14px (sm).
 *
 *              Popup polish blitz.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import "./PillButton.css";

export type PillButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "on-brand";

export type PillButtonSize = "sm" | "md";

interface PillButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: PillButtonVariant;
  size?: PillButtonSize;
  iconStart?: LucideIcon;
  iconEnd?: LucideIcon;
  /** Full-width inside its container (flex: 1). */
  block?: boolean;
  /** When the button is only an icon, supply ariaLabel for SR users. */
  ariaLabel?: string;
  children?: ReactNode;
}

/**
 * Single canonical button. Replaces CalciteButton in the popup /
 * featureCard action row and in module-page action chrome. Tools that
 * want a non-button rendering (link, nav target) should use a wrapper
 * around this rather than reinventing the styling.
 */
export const PillButton = ({
  variant = "secondary",
  size = "md",
  iconStart: IconStart,
  iconEnd: IconEnd,
  block = false,
  ariaLabel,
  className = "",
  type = "button",
  children,
  ...rest
}: PillButtonProps): JSX.Element => {
  const iconSize = size === "sm" ? 14 : 16;
  const stroke = 2.25;
  const cls = [
    "fwp-pill-button",
    variant === "primary" && "fwp-pill-button--primary",
    variant === "danger" && "fwp-pill-button--danger",
    variant === "ghost" && "fwp-pill-button--ghost",
    variant === "on-brand" && "fwp-pill-button--on-brand",
    size === "sm" && "fwp-pill-button--sm",
    block && "fwp-pill-button--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...rest} type={type} className={cls} aria-label={ariaLabel}>
      {IconStart ? <IconStart size={iconSize} strokeWidth={stroke} aria-hidden /> : null}
      {children ? <span className="fwp-pill-button__label">{children}</span> : null}
      {IconEnd ? <IconEnd size={iconSize} strokeWidth={stroke} aria-hidden /> : null}
    </button>
  );
};
