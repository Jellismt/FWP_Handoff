/**
 * @file Skeleton.tsx
 * @module engage-mt/shared
 * @description Skeleton loading primitives. SkeletonCard
 *              matches `<ListCard>` dimensions; SkeletonListItem is a
 *              smaller variant for inline rows. Animated shimmer via
 *              CSS keyframes; reduced-motion respected.
 *
 *              Accessibility: container carries `aria-busy="true"` +
 *              `aria-live="polite"` + an SR-only "Loading…" message
 *              so screen readers announce the state without spamming.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import "./Skeleton.css";

interface SkeletonCardProps {
  /** When true, suppress the `aria-live` so a parent container can own the announcement. */
  silent?: boolean;
  /** Test hook. */
  "data-testid"?: string;
}

/**
 * List-card-shaped skeleton. Drop in place of `<ListCard>` while data
 * is loading.
 */
export const SkeletonCard = ({
  silent = false,
  "data-testid": testId,
}: SkeletonCardProps): JSX.Element => (
  <div
    className="fwp-skeleton-card"
    data-testid={testId}
    aria-busy
    aria-live={silent ? undefined : "polite"}
  >
    <span className="fwp-sr-only">Loading…</span>
    <div className="fwp-skeleton__line fwp-skeleton__line--xs" />
    <div className="fwp-skeleton__line fwp-skeleton__line--md" />
    <div className="fwp-skeleton-card__meta">
      <div className="fwp-skeleton__cell" />
      <div className="fwp-skeleton__cell" />
      <div className="fwp-skeleton__cell" />
    </div>
    <div className="fwp-skeleton__line fwp-skeleton__line--sm" />
    <div className="fwp-skeleton__actions">
      <div className="fwp-skeleton__pill" />
      <div className="fwp-skeleton__pill" />
    </div>
  </div>
);

interface SkeletonListItemProps {
  silent?: boolean;
  "data-testid"?: string;
}

/**
 * Smaller variant for inline list rows (e.g., a Manage inbox).
 */
export const SkeletonListItem = ({
  silent = false,
  "data-testid": testId,
}: SkeletonListItemProps): JSX.Element => (
  <div
    className="fwp-skeleton-row"
    data-testid={testId}
    aria-busy
    aria-live={silent ? undefined : "polite"}
  >
    <span className="fwp-sr-only">Loading…</span>
    <div className="fwp-skeleton__line fwp-skeleton__line--sm" />
    <div className="fwp-skeleton__line fwp-skeleton__line--xs" />
  </div>
);

interface SkeletonGridProps {
  /** How many SkeletonCards to render. Defaults to 6 — enough to fill a viewport. */
  count?: number;
  "data-testid"?: string;
}

/**
 * Renders a grid of SkeletonCards. The container manages the
 * `aria-busy` so the individual cards can stay silent.
 */
export const SkeletonGrid = ({
  count = 6,
  "data-testid": testId,
}: SkeletonGridProps): JSX.Element => (
  <div className="fwp-skeleton-grid" data-testid={testId} aria-busy aria-live="polite">
    <span className="fwp-sr-only">Loading list…</span>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} silent />
    ))}
  </div>
);
