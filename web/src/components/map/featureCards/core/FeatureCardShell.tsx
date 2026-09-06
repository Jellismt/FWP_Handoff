/**
 * @file FeatureCardShell.tsx
 * @module engage-mt/map/featureCards
 * @description Shared chrome for every FeatureCard. Two presentations:
 *                'panel'    — right-rail/bottom-sheet card (default)
 *                'takeover' — full-screen Calcite dialog content
 *              Optional Tabs strip routes the active tab's Body.
 *              Panel preset surfaces an Expand button that escalates to
 *              takeover via the takeoverPopupStore.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, Maximize2, X } from "lucide-react";
import { MODULE_ACCENT_VAR } from "@/config/navigation";
import type { EngageMtModule } from "@/types/layers";
import { PillButton } from "@/components/shared/forms/PillButton";
import { useTakeoverPopupStore } from "@/store/map/takeoverPopupStore";
import type {
  FeatureRendererProps,
  FeatureRendererTab,
} from "@/components/map/featureCards/core/types";
import "./FeatureCardShell.css";

/**
 * Tab strip with WAI-ARIA "Tabs Manual Activation" keyboard nav.
 * Arrow Left/Right cycles, Home/End jump to first/last, Tab moves focus
 * into the tabpanel content. Selection is on Enter/Space (manual activation)
 * — moving focus does NOT auto-activate the tab.
 */
const TabStrip = ({
  tabs,
  activeTabId,
  onSelect,
}: {
  tabs: readonly FeatureRendererTab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusTab = (idx: number): void => {
    const wrapped = (idx + tabs.length) % tabs.length;
    tabRefs.current[wrapped]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number): void => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusTab(idx + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusTab(idx - 1);
        break;
      case "Home":
        e.preventDefault();
        focusTab(0);
        break;
      case "End":
        e.preventDefault();
        focusTab(tabs.length - 1);
        break;
    }
  };

  return (
    <div className="feature-card__tabs" role="tablist">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            tabRefs.current[i] = el;
          }}
          type="button"
          role="tab"
          aria-selected={t.id === activeTabId}
          tabIndex={t.id === activeTabId ? 0 : -1}
          className={`feature-card__tab ${t.id === activeTabId ? "feature-card__tab--active" : ""}`}
          onClick={() => onSelect(t.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};

interface Props {
  module: EngageMtModule;
  title: string;
  subtitle?: string;
  /** Suppress the header meta-row (layer · subtitle · freshness) entirely. */
  hideMeta?: boolean;
  /** Suppress the whole header (title + meta) on full cards. */
  hideHeader?: boolean;
  layerId: string;
  layerTitle: string;
  detailRoute?: string | null;
  attrs: Record<string, unknown>;
  /** Body for the default tab (or the only body when no tabs). */
  body: ReactNode;
  /** Optional tabs strip. If present, the active tab's Body replaces `body`. */
  tabs?: readonly FeatureRendererTab[];
  /** Optional dedicated chart node — rendered above the body in takeover only. */
  chart?: ReactNode;
  enrichment?: ReactNode;
  /** Optional override for the action row. */
  actions?: ReactNode;
  /** Visual density preset. Defaults to 'panel'. */
  presentation?: "panel" | "takeover";
  /** Props forwarded to tab Body components when used. */
  rendererProps?: FeatureRendererProps;
  /**
   * One of several siblings in TapQueryPanel's multi-feature list. Triggers
   * the compact chrome (`data-multi-feature="true"`): tighter padding, no
   * subtitle / freshness chip in the header, single Expand action.
   */
  multiFeature?: boolean;
}

export const FeatureCardShell = ({
  module,
  title,
  subtitle,
  hideMeta,
  hideHeader,
  layerId,
  layerTitle,
  detailRoute,
  body,
  tabs,
  chart,
  enrichment,
  actions,
  presentation = "panel",
  rendererProps,
  multiFeature,
}: Props): JSX.Element => {
  const navigate = useNavigate();
  const accent = MODULE_ACCENT_VAR[module];
  const openTakeover = useTakeoverPopupStore((s) => s.openFeature);
  const closeTakeover = useTakeoverPopupStore((s) => s.close);

  // Tabs only render in the takeover preset. The inline
  // panel keeps the dense single-body layout so renderers that declare
  // tabs don't crowd the right-rail card.
  const tabsActive = presentation === "takeover" && tabs !== undefined && tabs.length > 0;
  const initialTabId = tabsActive ? tabs![0].id : null;
  const [activeTabId, setActiveTabId] = useState<string | null>(initialTabId);

  const activeTab =
    tabsActive && activeTabId ? (tabs!.find((t) => t.id === activeTabId) ?? tabs![0]) : null;

  const renderedBody = activeTab && rendererProps ? <activeTab.Body {...rendererProps} /> : body;

  const expand = (): void => {
    if (rendererProps) {
      openTakeover({
        layerId,
        layerTitle,
        module,
        attrs: rendererProps.attrs,
      });
    }
  };

  // In multi-feature mode the per-card action row collapses to a single
  // Expand button — the panel-level Close handles dismissal, and
  // module switching belongs on the takeover where there's room for it.
  const defaultActions = multiFeature ? (
    <div className="feature-card__actions">
      <PillButton
        variant="primary"
        iconStart={Maximize2}
        onClick={expand}
        title="Open in a full-screen view"
      >
        Expand
      </PillButton>
    </div>
  ) : (
    <div className="feature-card__actions">
      {detailRoute && (
        <PillButton
          variant="primary"
          iconEnd={ArrowRight}
          onClick={() => {
            closeTakeover();
            navigate(detailRoute);
          }}
        >
          Open detail
        </PillButton>
      )}
      {presentation === "panel" && (
        <PillButton
          variant="ghost"
          iconStart={Maximize2}
          onClick={expand}
          title="Open in a full-screen view"
        >
          Expand
        </PillButton>
      )}
      {presentation === "takeover" && (
        <PillButton variant="ghost" iconStart={X} onClick={closeTakeover}>
          Close
        </PillButton>
      )}
    </div>
  );

  return (
    <article
      className={`feature-card feature-card--${presentation}`}
      style={{ "--module-accent": accent } as React.CSSProperties}
      data-module={module}
      data-multi-feature={multiFeature ? "true" : undefined}
    >
      {/* Two-line header. Line 1 = badge + title; line 2 =
          single horizontal metadata strip (layer · optional subtitle ·
          freshness chip). Previously the subtitle stacked above a third
          line for the freshness chip, eating vertical space and
          producing the screenshot's awkward wrap. */}
      {(!hideHeader || multiFeature) && (
        <header className="feature-card__header">
          <div className="feature-card__heading">
            <div className="feature-card__title-row">
              <h3 className="feature-card__title">{title}</h3>
              {/* Static visual cue that more content is available
                via the action buttons (Open detail / Expand). Not gated
                on takeover state — just an affordance. */}
              {(detailRoute || presentation === "panel") && (
                <ChevronDown
                  size={14}
                  strokeWidth={2.25}
                  className="feature-card__title-chevron"
                  aria-hidden
                />
              )}
            </div>
            {/* The meta strip is the renderer's subtitle and
                nothing else — not the layer title or a
                freshness chip ("USFS National Forest System Trails · … ·
                Weekly · USDA Forest Service · EDW") — provenance that restated
                the layer the user just tapped and buried the one useful fact
                (who owns it). */}
            {!hideMeta && subtitle && (
              <div className="feature-card__meta-row">
                <span className="feature-card__meta-sub">{subtitle}</span>
              </div>
            )}
          </div>
        </header>
      )}

      {presentation === "takeover" && chart && <div className="feature-card__chart">{chart}</div>}

      {tabsActive && <TabStrip tabs={tabs!} activeTabId={activeTabId} onSelect={setActiveTabId} />}

      <div className="feature-card__body">{renderedBody}</div>

      {enrichment && <div className="feature-card__enrichment">{enrichment}</div>}

      {actions ?? defaultActions}
    </article>
  );
};
