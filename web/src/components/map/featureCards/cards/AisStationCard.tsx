/**
 * @file AisStationCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for AIS watercraft inspection stations. Leads with
 *              the mandatory-stop intent, then station type / hours / season /
 *              agency, Clean·Drain·Dry guidance, and FWP-page + directions links.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ExternalLink, Navigation } from "lucide-react";
import {
  HeroBlock,
  MetricGrid,
  MetricPill,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { LinkRow, type LinkRowLink } from "@/components/map/featureCards/enrichments/LinkRow";

const AIS_PAGE_URL = "https://fwp.mt.gov/aboutfwp/ais/inspection-stations";

/**
 * AIS service `DATEOPEN` / `DATECLOSE` arrive either as an ArcGIS epoch-ms
 * number or a pre-formatted date string. Reduce both to a short, human label;
 * return null when absent so the season pill drops cleanly.
 */
const shortDate = (v: unknown): string | null => {
  const n = num(v);
  if (n !== null && n > 100_000_000_000) {
    // Epoch milliseconds — format month + day in UTC to avoid TZ drift.
    const d = new Date(n);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  return str(v);
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const type = str(get("STATIONTYP", "StationType", "TYPE"));
  const hours = str(get("HOURSDAYS", "HOURS", "Hours", "OperatingHours"));
  const agency = str(get("AGENCY", "Agency"));
  const open = shortDate(get("DATEOPEN", "OPEN_SEASON"));
  const close = shortDate(get("DATECLOSE"));
  const season = open && close ? `${open} – ${close}` : (open ?? close);

  return (
    <>
      <HeroBlock value="Mandatory stop" />
      <MetricGrid stack>
        {type && <MetricPill label="Type" value={type} />}
        {hours && <MetricPill label="Hours" value={hours} />}
        {season && <MetricPill label="Season" value={season} />}
        {agency && <MetricPill label="Operated by" value={agency} />}
      </MetricGrid>
      <TipBlock heading="Clean · Drain · Dry" intent="warning">
        All watercraft must stop at every open inspection station. Empty livewells, drain bilges,
        remove plant matter. Skipping a station is a Montana state law violation.
      </TipBlock>
    </>
  );
};

const buildLinks = (props: FeatureRendererProps): readonly (LinkRowLink | null)[] => {
  const get = pick(props.attrs);
  // AIS features don't carry lat/lon in outFields, so fall back to the tap
  // point that produced the card (a point tap lands on the station). Absent on
  // programmatic renders — the directions link simply drops.
  const lat = num(get("LATITUDE", "latitude")) ?? props.tapPoint?.latitude ?? null;
  const lon = num(get("LONGITUDE", "longitude")) ?? props.tapPoint?.longitude ?? null;
  const directionsUrl =
    lat !== null && lon !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
      : null;
  return [
    { label: "AIS stations at fwp.mt.gov", href: AIS_PAGE_URL, icon: ExternalLink },
    directionsUrl ? { label: "Directions", href: directionsUrl, icon: Navigation } : null,
  ];
};

const Enrichment = (props: FeatureRendererProps): JSX.Element | null => (
  <LinkRow links={buildLinks(props)} />
);

registerFeature("ais-inspection-stations", {
  summary: (a) =>
    String(a.STATIONNM ?? a.NAME ?? a.StationName ?? a.Name ?? "AIS Inspection Station"),
  subtitle: () => "Mandatory watercraft stop",
  Body,
  Enrichment,
});
