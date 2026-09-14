/**
 * @file EmptyStateCard.tsx
 * @module engage-mt/shared
 * @description Standardized empty state. Replaces the
 *              ad-hoc "no results" rendering across list / dashboard
 *              pages with a centered card carrying icon + title +
 *              body + up to 3 suggested actions.
 *
 *              FWP voice (per docs/rules/notifications.md § "Voice"):
 *                - Authoritative + accessible
 *                - No blame
 *                - Single clear next step
 *                - Plain English
 *
 *              Accessibility: container is `role="status"` so the
 *              empty state is announced once when it appears.
 *              Suggestion pills are keyboard-reachable PillButtons.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { type ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import type { EngageMtModule } from "@/types/layers";
import { PillButton } from "@/components/shared/forms/PillButton";
import "./EmptyStateCard.css";

export interface EmptyStateSuggestion {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateCardProps {
  /** Optional Lucide icon at the top (default Inbox). */
  icon?: LucideIcon;
  /** Short heading. */
  title: string;
  /** 1–2 sentence body. */
  body: ReactNode;
  /** Up to 3 suggestion pills. */
  suggestions?: EmptyStateSuggestion[];
  /** Color the icon halo to a module accent. */
  module?: EngageMtModule | "shared";
  /** Compact variant (smaller padding) for inline use. */
  compact?: boolean;
  /** Test hook. */
  "data-testid"?: string;
}

export const EmptyStateCard = ({
  icon: Icon = Inbox,
  title,
  body,
  suggestions,
  module = "shared",
  compact = false,
  "data-testid": testId,
}: EmptyStateCardProps): JSX.Element => {
  const classes = ["fwp-empty-state", compact ? "fwp-empty-state--compact" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} data-module={module} data-testid={testId} role="status">
      <span className="fwp-empty-state__halo" aria-hidden>
        <Icon size={compact ? 24 : 32} strokeWidth={2} aria-hidden />
      </span>
      <h2 className="fwp-empty-state__title">{title}</h2>
      <p className="fwp-empty-state__body">{body}</p>
      {suggestions && suggestions.length > 0 ? (
        <div className="fwp-empty-state__suggestions">
          {suggestions.slice(0, 3).map((s, i) => {
            if (s.href) {
              return (
                <a
                  key={`${s.label}-${i}`}
                  className="fwp-pill-button fwp-pill-button--sm"
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                >
                  <span className="fwp-pill-button__label">{s.label}</span>
                </a>
              );
            }
            return (
              <PillButton key={`${s.label}-${i}`} size="sm" variant="ghost" onClick={s.onClick}>
                {s.label}
              </PillButton>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
