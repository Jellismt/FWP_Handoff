/**
 * @file TapQueryPanel.tsx
 * @module engage-mt/map
 * @description Tap-to-query result surface.
 *
 *              Promoted from a Calcite right-rail shell-panel
 *              to a **takeover overlay**: the popup now occupies
 *              the entire viewport area between the FWP-Blue AppHeader at
 *              the top and the FWP-Blue BottomTabBar at the bottom, with
 *              its own scroll container, backdrop, and explicit close
 *              affordance. Single + multi-feature results both render in
 *              the same chrome. Mobile (<768px) lays out as a full-bleed
 *              modal sheet; tablet/desktop (>=768px) dock as a non-modal
 * Right rail beside a fully-interactive map.
 *
 * — popup state stays local; the result data
 *              still flows from MapView's click handler.
 *
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-07
 * @version 2.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalciteNotice } from "@esri/calcite-components-react";
import { Layers, Loader2, X } from "lucide-react";
import type { EngageMtModule } from "@/types/layers";
import { FeatureCard } from "@/components/map/featureCards";
import { resolveFeature } from "@/components/map/featureCards/core/registry";
import { useTapQueryFailureStore, selectFailureList } from "@/store/map/tapQueryFailureStore";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import "./TapQueryPanel.css";

export interface TapQueryResult {
  layerId: string;
  layerTitle: string;
  module: EngageMtModule;
  features: Record<string, unknown>[];
}

/**
 * The lazily-queryable "there are other features here too"
 * payload that rides alongside the topmost result. `candidates` is derived from
 * the click's own hitTest stack (zero network); `run()` queries just those
 * layers on demand when the user taps "N more features here", so the Phase-19
 * single-topmost default keeps its no-extra-latency behavior.
 */
export interface TapQueryMore {
  candidates: readonly { layerId: string; layerTitle: string; module: EngageMtModule }[];
  run: () => Promise<TapQueryResult[]>;
}

import type { TapPoint } from "@/components/map/featureCards/core/types";

interface TapQueryPanelProps {
  results: TapQueryResult[] | null;
  onClose: () => void;
  active: boolean;
  /**
   * Tap-point that produced these results. Threaded to every FeatureCard
   * so cross-layer enrichments (e.g. NearbyPublicAccessBlock) can derive
   * nearby context without each renderer reaching back into the map view.
   */
  tapPoint?: TapPoint | null;
  /**
   * "N more features here" payload for the current tap.
   * When present, the panel shows an affordance that lazily queries the other
   * layers under the click and appends them in-panel.
   */
  more?: TapQueryMore | null;
}

export const TapQueryPanel = ({
  results,
  onClose,
  active,
  tapPoint,
  more,
}: TapQueryPanelProps): JSX.Element | null => {
  const navigate = useNavigate();
  const failures = useTapQueryFailureStore(selectFailureList);
  const cardRef = useRef<HTMLDivElement>(null);
  // Results appended by "N more features here" (queried lazily on tap).
  const [extra, setExtra] = useState<TapQueryResult[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreShown, setMoreShown] = useState(false);

  // A new tap replaces `results` — clear any appended "more" from the last tap.
  useEffect(() => {
    setExtra([]);
    setLoadingMore(false);
    setMoreShown(false);
  }, [results]);

  const hasMore = Boolean(more && more.candidates.length > 0) && !moreShown;
  const merged = results ? [...results, ...extra] : results;

  const loadMore = async (): Promise<void> => {
    if (!more || loadingMore) return;
    setLoadingMore(true);
    setMoreShown(true);
    try {
      const rows = await more.run();
      setExtra(rows);
    } finally {
      setLoadingMore(false);
    }
  };

  // Every tap now lands in THIS panel: a right rail on desktop, a
  // full-screen sheet on phones. No renderer auto-routes to the centred
  // CalciteDialog takeover; the takeover portal exists only for the
  // user-initiated Expand button.

  // Layers whose renderer declares `tapRoute` skip the card entirely: the
  // hunting-district + district-portion polygons exist to open that district's
  // report, so a tap navigates there and dismisses this panel. Checked across
  // every hit (topmost first) because a district tap almost always also lands
  // on Public Lands / cadastral underneath.
  useEffect(() => {
    if (!active || !results || results.length === 0) return;
    for (const group of results) {
      const feature = group.features[0];
      if (!feature) continue;
      const route = resolveFeature(group.layerId)?.tapRoute?.(feature);
      if (route) {
        onClose();
        navigate(route);
        return;
      }
    }
  }, [active, results, onClose, navigate]);

  // At ≥768px the panel docks as a right rail beside a
  // fully-interactive map (a coexistent surface), so it must NOT be a modal:
  // no backdrop, no focus trap, non-modal semantics. Below 768px it stays a
  // full-bleed sheet with the modal behavior (backdrop + trap).
  const isRail = useMediaQuery("(min-width: 768px)");

  // A modal traps focus; a rail must not (the map stays keyboard-reachable).
  useFocusTrap({
    active: Boolean(active && results && !isRail),
    containerRef: cardRef,
    onEscape: onClose,
  });

  // In rail mode the focus trap is off, so wire Esc-to-close directly.
  useEffect(() => {
    if (!isRail || !active || !results) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRail, active, results, onClose]);

  if (!active || !results || !merged) return null;

  const total = merged.reduce((n, r) => n + r.features.length, 0);
  // Render cards in compact panel chrome (never inline takeover-styled) whenever
  // the tap surfaces more than one thing — either already-multi-feature, or a
  // single topmost that we kept in-panel because other layers are one tap away.
  // Stable across the tap (keyed on `more`, not the post-load count) so a card
  // doesn't flip presentation after "N more" resolves.
  const compactCards = total > 1 || Boolean(more && more.candidates.length > 0);

  return (
    <div
      className={`tap-query-shell${isRail ? " tap-query-shell--rail" : ""}`}
      role={isRail ? "complementary" : "dialog"}
      aria-modal={isRail ? undefined : "true"}
      aria-labelledby="tap-query-heading"
    >
      {/* Modal (mobile) only: aria-hidden backdrop for sighted click-to-dismiss;
          Esc + the close button are the SR-driven paths. The rail has no
          backdrop — the map stays visible AND interactive beside it (item 15). */}
      {!isRail && (
        <div className="tap-query-shell__backdrop" onClick={onClose} aria-hidden="true" />
      )}
      <div ref={cardRef} className="tap-query-shell__card">
        <header className="tap-query-shell__header">
          <div className="tap-query-shell__title-block">
            <h2 id="tap-query-heading" className="tap-query-shell__title">
              {merged.length === 0
                ? failures.length > 0
                  ? "Couldn't check this spot"
                  : "No features here"
                : "What's here"}
            </h2>
            <p className="tap-query-shell__subtitle">
              {merged.length === 0
                ? failures.length > 0
                  ? "A map service didn't answer, so this may not be empty. Tap again to retry."
                  : "No parcel or feature record at this point. Tap a location on the map to see what applies."
                : `${total} feature${total === 1 ? "" : "s"} across ${merged.length} layer${merged.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            type="button"
            className="fwp-icon-close"
            onClick={onClose}
            aria-label="Close popup"
          >
            <X size={20} strokeWidth={2.25} aria-hidden />
          </button>
        </header>
        <div className="tap-query-shell__body" aria-live="polite">
          {failures.length > 0 && (
            <CalciteNotice
              open
              kind="warning"
              icon="exclamation-mark-triangle"
              scale="m"
              className="tap-query-shell__failure-notice"
            >
              <span slot="title">
                {failures.length === 1
                  ? "1 layer couldn't respond"
                  : `${failures.length} layers couldn't respond`}
              </span>
              <span slot="message">
                {failures
                  .slice(0, 3)
                  .map((f) => f.layerTitle)
                  .join(", ")}
                {failures.length > 3 ? ` and ${failures.length - 3} more` : ""}. Tap again to retry
                — check your connection and try again.
              </span>
            </CalciteNotice>
          )}
          {merged.length === 0 ? (
            <CalciteNotice open icon="map-pin" scale="m">
              <span slot="title">No visible layer reported a hit.</span>
              <span slot="message">
                Try turning on additional layers from the layer panel, or zoom in and tap again.
              </span>
            </CalciteNotice>
          ) : (
            merged.flatMap((group) => {
              // Renderers can opt in to single-card representation
              // for multi-feature taps when their Body is keyed on the
              // tapPoint (i.e. the rendered content is identical for every
              // sibling feature at that point). Collapse to the first
              // feature; the renderer's subtitle surfaces the actual count
              // via the `siblingCount` prop.
              const renderer = resolveFeature(group.layerId);
              const collapse =
                renderer?.collapseDuplicatesAtTap === true && group.features.length > 1;
              const featuresToRender = collapse ? group.features.slice(0, 1) : group.features;
              const siblingCount = collapse ? group.features.length : 1;
              return featuresToRender.map((attrs, idx) => (
                <FeatureCard
                  key={`${group.layerId}-${idx}`}
                  layerId={group.layerId}
                  layerTitle={group.layerTitle}
                  module={group.module}
                  attrs={attrs}
                  tapPoint={tapPoint ?? undefined}
                  /* Multi-feature taps render every renderer in compact panel
                     chrome, regardless of its declared presentation. Each
                     row's Expand button (or the dedicated takeover routes,
                     where applicable) escalates to the full-screen view —
                     stacking takeover-styled cards inline produces the big,
                     clunky look the user flagged. */
                  presentationOverride={compactCards ? "panel" : undefined}
                  multiFeature={compactCards}
                  siblingCount={siblingCount}
                />
              ));
            })
          )}
          {/* "N more features here". Only the topmost
              Feature is shown by default; this lazily queries the
              other layers the click landed on so overlapping features (e.g. a
              WMA sitting over a hunting district) are reachable without turning
              a layer off. */}
          {hasMore && (
            <button
              type="button"
              className="tap-query-shell__more"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <Loader2
                  size={16}
                  strokeWidth={2.25}
                  className="tap-query-shell__more-spin"
                  aria-hidden
                />
              ) : (
                <Layers size={16} strokeWidth={2.25} aria-hidden />
              )}
              {loadingMore
                ? "Checking other layers…"
                : `${more!.candidates.length} more feature${more!.candidates.length === 1 ? "" : "s"} here`}
            </button>
          )}
          {moreShown && !loadingMore && extra.length === 0 && (
            <p className="tap-query-shell__more-empty">No other features at this exact spot.</p>
          )}
        </div>
      </div>
    </div>
  );
};
