/**
 * @file CwdCheckStationCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for CWD check stations (point features) — the
 *              seasonal FWP stations where hunters submit deer & elk samples for
 *              chronic wasting disease testing. Leads with the parent zone's
 *              testing intent, then season / districts / region, sampling
 *              guidance, and FWP-page + directions links.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ExternalLink, Navigation } from "lucide-react";
import {
  ExplainerNote,
  MetricCallout,
  MetricGrid,
  MetricPill,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { LinkRow, type LinkRowLink } from "@/components/map/featureCards/enrichments/LinkRow";

const CWD_PAGE_URL = "https://fwp.mt.gov/cwd";

/** Zone status → headline copy + callout intent. Mirrors CwdPriorityCard voice. */
const statusCopy = (
  status: string | null,
): { value: string; sub: string; intent: "warning" | "default" } => {
  if (status && /mandator|required/i.test(status)) {
    return {
      value: "Testing required",
      sub: "Every harvested deer or elk in this area must be sampled",
      intent: "warning",
    };
  }
  if (status && /encourag/i.test(status)) {
    return {
      value: "Testing encouraged",
      sub: "Voluntary sampling — strongly recommended",
      intent: "default",
    };
  }
  return {
    value: "Voluntary sampling",
    sub: "FWP welcomes samples to track where the disease is spreading",
    intent: "default",
  };
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const status = str(get("status", "STATUS"));
  // Live FWP PublicView service publishes DATES (season window) + DAY_TIME
  // (hours) + LOCATION; the older bundled fixture used season/districts/…
  const season = str(get("DATES", "season", "SEASON"));
  const dayTime = str(get("DAY_TIME", "hours", "HOURS"));
  const location = str(get("LOCATION", "location"));
  const districts = str(get("districts", "DISTRICTS"));
  const region = num(get("REGION", "region"));
  const county = str(get("county", "COUNTY"));
  const zoneName = str(get("zoneName", "ZONE_NAME"));

  const headline = statusCopy(status);

  return (
    <>
      <MetricCallout
        title="CWD sampling station"
        value={headline.value}
        sub={headline.sub}
        intent={headline.intent}
      />
      <ExplainerNote>
        A check station is where you drop a head or lymph-node sample so FWP can test a harvested
        deer or elk for Chronic Wasting Disease — a fatal prion disease in deer and elk. Testing is
        free; results come back in 2–4 weeks.
      </ExplainerNote>
      <MetricGrid stack>
        {season && <MetricPill label="Dates" value={season} domain="wildlife" />}
        {dayTime && <MetricPill label="Hours" value={dayTime} domain="wildlife" />}
        {location && <MetricPill label="Location" value={location} domain="wildlife" />}
        {districts && <MetricPill label="Districts" value={districts} domain="wildlife" />}
        {region !== null && <MetricPill label="Region" value={`${region}`} domain="wildlife" />}
        {county && <MetricPill label="County" value={county} domain="wildlife" />}
      </MetricGrid>
      <TipBlock heading="What to bring" intent="info">
        Bring the head with at least 4 inches of neck attached, plus your license/CID number and the
        harvest location (hunting district). Drop-off is self-service at most stations
        {zoneName ? ` for the ${zoneName}` : ""}
        {dayTime
          ? ""
          : " — hours vary by station, so check the FWP page or call ahead before you go"}
        .
      </TipBlock>
    </>
  );
};

const buildLinks = (attrs: FeatureRendererProps["attrs"]): readonly (LinkRowLink | null)[] => {
  const get = pick(attrs);
  const lat = num(get("LAT", "lat", "LATITUDE", "latitude"));
  const lon = num(get("LONG_", "lon", "LONGITUDE", "longitude"));
  const directionsUrl =
    lat !== null && lon !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
      : null;
  return [
    { label: "CWD testing at fwp.mt.gov", href: CWD_PAGE_URL, icon: ExternalLink },
    directionsUrl ? { label: "Directions", href: directionsUrl, icon: Navigation } : null,
  ];
};

const Enrichment = ({ attrs }: FeatureRendererProps): JSX.Element | null => (
  <LinkRow links={buildLinks(attrs)} />
);

registerFeature("cwd-check-stations", {
  summary: (a) => String(a.name ?? a.NAME ?? a.Name ?? "CWD Check Station"),
  // The provenance strip (layer · subtitle · Weekly · FWP Wildlife Health) was
  // noise on this card — the body already explains what a check station is.
  hideMeta: true,
  Body,
  Enrichment,
});
