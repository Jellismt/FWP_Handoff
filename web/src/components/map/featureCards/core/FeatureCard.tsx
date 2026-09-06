/**
 * @file FeatureCard.tsx
 * @module engage-mt/map/featureCards
 * @description The single integration point used by TapQueryPanel + the takeover
 *              popup portal. Resolves a renderer through the registry, composes
 *              summary + Body via the shared FeatureCardShell, and forwards the
 *              regulation enrichment block automatically for waterbody-typed
 *              features. Honors per-renderer presentation declarations + a
 *              caller-provided presentation override (the takeover portal uses
 *              the override to escalate any panel renderer to full-screen).
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-04
 * @version 1.2.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { EngageMtModule } from "@/types/layers";
import { FeatureCardShell } from "@/components/map/featureCards/core/FeatureCardShell";
import { genericRenderer } from "@/components/map/featureCards/core/GenericCard";
import { resolveFeature } from "@/components/map/featureCards/core/registry";
import type { TapPoint } from "@/components/map/featureCards/core/types";

interface Props {
  layerId: string;
  layerTitle: string;
  module: EngageMtModule;
  attrs: Record<string, unknown>;
  /**
   * Force a presentation density regardless of the renderer's declaration.
   * Used by TakeoverPopupPortal to render any renderer as a takeover.
   */
  presentationOverride?: "panel" | "takeover";
  /**
   * Tap-point that produced this card. Threaded into renderer props so
   * cross-layer enrichment helpers (e.g. NearbyPublicAccessBlock) can run.
   */
  tapPoint?: TapPoint;
  /**
   * Set when this card is one of several rendered inline in TapQueryPanel.
   * The shell collapses to a compact row in that mode (tighter padding,
   * single-line header, only the Expand action) so 3+ siblings stack
   * readably on a 375 px mobile viewport. Single-feature taps pass false.
   */
  multiFeature?: boolean;
  /**
   * Number of sibling features this card represents. Defaults to 1.
   * > 1 only when the renderer set `collapseDuplicatesAtTap` and the
   * tap returned multiple features for its layer — TapQueryPanel
   * collapses the group to one representative card and threads the
   * original count here so the subtitle can surface it.
   */
  siblingCount?: number;
}

export const FeatureCard = ({
  layerId,
  layerTitle,
  module,
  attrs,
  presentationOverride,
  tapPoint,
  multiFeature,
  siblingCount = 1,
}: Props): JSX.Element => {
  const renderer = resolveFeature(layerId) ?? genericRenderer(layerTitle);
  const detailRoute = renderer.detailRoute?.(attrs) ?? null;
  const rendererSubtitle = renderer.subtitle?.(attrs);
  // When a collapsed-duplicates card represents N siblings,
  // prepend the count so the user sees "3 surveys here · …" instead of
  // just one record's subtitle and wonders where the others went.
  const subtitle =
    siblingCount > 1
      ? `${siblingCount} features here${rendererSubtitle ? ` · ${rendererSubtitle}` : ""}`
      : rendererSubtitle;

  const Body = renderer.Body;
  const Actions = renderer.Actions;
  const Enrichment = renderer.Enrichment;
  const Chart = renderer.Chart;
  const presentation = presentationOverride ?? renderer.presentation ?? "panel";

  const rendererProps = {
    layerId,
    layerTitle,
    module,
    attrs,
    tapPoint,
    presentation,
  };

  return (
    <FeatureCardShell
      module={module}
      title={renderer.summary(attrs)}
      subtitle={subtitle}
      layerId={layerId}
      layerTitle={layerTitle}
      hideMeta={renderer.hideMeta}
      hideHeader={renderer.hideHeader}
      detailRoute={detailRoute}
      attrs={attrs}
      presentation={presentation}
      multiFeature={multiFeature}
      tabs={renderer.tabs}
      rendererProps={rendererProps}
      chart={Chart ? <Chart {...rendererProps} /> : undefined}
      body={<Body {...rendererProps} />}
      enrichment={Enrichment ? <Enrichment {...rendererProps} /> : undefined}
      actions={Actions ? <Actions {...rendererProps} /> : undefined}
    />
  );
};
