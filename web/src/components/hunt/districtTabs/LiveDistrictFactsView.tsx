/**
 * @file LiveDistrictFactsView.tsx
 * @module engage-mt/hunt
 * @description Facts view for a hunting district that isn't in the curated
 *              Deer/Elk/Lion Tier-2 dataset — i.e. a single-species district
 *              (Moose, Bighorn Sheep, Mountain Goat, Antelope, or Upland Bird).
 *
 *              Rather than dead-ending at "No facts on file," the district
 *              detail page falls back to this view, which renders the facts FWP
 *              actually publishes for these districts — region, acreage, the
 *              species that hold the district, and FWP's own per-district
 *              hunting guide + district-map links — fetched live from the
 *              public FWP-GIS REST services (see services/hunt/
 *              huntingDistrictsLive.ts).
 *
 *              The full tabbed report (seasons, regulations, contact) stays
 *              reserved for general-license Deer/Elk/Lion districts; the copy
 *              here is explicit that single-species districts are limited-draw
 *              and points the hunter at the authoritative FWP guide.
 *
 *              Accessibility: composes the shared HeroBlock / BadgeRow /
 *              TipBlock primitives (each already SR-labelled); the external
 *              links are real Pill buttons with descriptive labels.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-16
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Link } from "react-router-dom";
import { prefetchProps } from "@/utils/routePrefetch";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { BadgeRow, TipBlock } from "@/components/map/featureCards/core/cardPrimitives";
import { PillButton } from "@/components/shared/forms/PillButton";
import { FreshnessChip } from "@/components/shared/widgets/FreshnessChip";
import { formatCompact } from "@/utils/formatNumber";
import type { LiveDistrictFacts } from "@/services/hunt/huntingDistrictsLive";

interface LiveDistrictFactsViewProps {
  facts: LiveDistrictFacts;
}

export const LiveDistrictFactsView = ({ facts }: LiveDistrictFactsViewProps): JSX.Element => {
  const speciesLabels = facts.species.map((s) => s.species);

  return (
    <section className="hd-tabs fwp-mobile-safe-bottom" data-module="hunt">
      <header className="hd-tabs__header">
        <Link to="/hunt/districts" className="hd-tabs__back" {...prefetchProps("/hunt/districts")}>
          <ArrowLeft size={14} strokeWidth={2.25} aria-hidden /> All districts
        </Link>
        <h1 className="hd-tabs__title">HD {facts.district}</h1>
        {facts.region > 0 && <p className="hd-tabs__fact">FWP Region {facts.region}</p>}
        {facts.acres > 0 && <p className="hd-tabs__fact">{formatCompact(facts.acres, "acres")}</p>}
      </header>

      <div className="hd-tabs__hero">
        <BadgeRow
          label="Open species"
          badges={speciesLabels.map((label) => ({ label, intent: "default" as const }))}
        />
      </div>

      <div className="hd-tabs__panel">
        <TipBlock heading="Limited-draw district" intent="info">
          These districts are single-species, limited-draw hunts — FWP doesn&rsquo;t publish the
          general-license season and regulation tables that fill the full district report. Open
          FWP&rsquo;s per-district hunting guide below for the authoritative season dates, quota,
          and application details.
        </TipBlock>

        {facts.species.map((s) => (
          <div className="hd-live__species" key={s.species}>
            <p className="hd-live__species-label">{s.species}</p>
            <div className="feature-card__actions">
              {s.guideUrl && (
                <PillButton
                  variant="primary"
                  size="sm"
                  iconEnd={ExternalLink}
                  onClick={() => window.open(s.guideUrl as string, "_blank", "noopener")}
                >
                  {s.species} hunting guide
                </PillButton>
              )}
              {s.mapUrl && (
                <PillButton
                  variant="secondary"
                  size="sm"
                  iconEnd={FileText}
                  onClick={() => window.open(s.mapUrl as string, "_blank", "noopener")}
                >
                  District map (PDF)
                </PillButton>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hd-tabs__freshness-foot">
        <FreshnessChip freshness="static" source={facts.source} />
      </div>
    </section>
  );
};
