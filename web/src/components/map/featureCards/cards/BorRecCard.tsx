/**
 * @file BorRecCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for Bureau of Reclamation
 *              recreation sites, now harmonized with BlmRecCard +
 *              UsfsRecCard so the three cards under the
 *              `federal-recreation-sites` composite share one design
 *              language. Slot order locked across all three.
 *
 *              FWP-via-BOR MapServer schema (probed Jun 5):
 *
 *                OBJECTID, SITENAME, WATERBODY
 *
 *              Shared slot order:
 *
 *                1. MetricCallout — site name + inferred type + agency sub
 *                2. DomainPill row — Waterbody
 *                3. MetricGrid amenity pills — n/a for BOR
 *                4. Description Paragraph — n/a for BOR
 *                5. TipBlock — reservation guidance (campground vs other)
 *                6. Link enrichment (facility
 *                   deep-link + Directions)
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-07-14
 * @version 2.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import {
  HeroBlock,
  MetricGrid,
  MetricPill,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const name = str(get("SITENAME", "SITE_NAME", "NAME", "Name"));
  const waterbody = str(get("WATERBODY", "Waterbody"));

  // Categorize the site by name conventions — most BOR sites in MT are
  // boat launches, day-use, or campgrounds; the name usually says which.
  const nameLower = (name ?? "").toLowerCase();
  const isCampground = /campground|camp/i.test(nameLower);
  const isLaunch = /ramp|launch|landing|put-?in/i.test(nameLower);
  const isMarina = /marina|harbor/i.test(nameLower);
  const isDayUse = /day.?use|picnic|park|inlet|overlook/i.test(nameLower);

  const calloutValue = isCampground
    ? "Campground"
    : isMarina
      ? "Marina"
      : isLaunch
        ? "Boat launch"
        : isDayUse
          ? "Day-use site"
          : "Reclamation recreation site";

  return (
    <>
      <HeroBlock caption="Bureau of Reclamation" value={calloutValue} />
      {waterbody && (
        <MetricGrid stack>
          <MetricPill label="Waterbody" value={waterbody} />
        </MetricGrid>
      )}
      {isCampground ? (
        <TipBlock heading="Reservations recommended" intent="warning">
          Developed BOR sites book up — reserve ahead where the site supports it. Some sites have
          first-come-first-served loops; check with the managing office for details.
        </TipBlock>
      ) : (
        <TipBlock heading="BOR access rules" intent="info">
          Day-use at most BOR sites is open without a reservation. Fishing regulations follow
          Montana FWP rules for the waterbody.
        </TipBlock>
      )}
    </>
  );
};

registerFeature("bor-recreation-sites", {
  summary: (a) => String(a.SITENAME ?? a.SITE_NAME ?? a.NAME ?? a.Name ?? "BOR recreation site"),
  subtitle: () => "Bureau of Reclamation · Montana",
  Body,
  // Promote to takeover to match BlmRecCard + UsfsRecCard so
  // the three federal-rec cards open identically on single tap.
});
