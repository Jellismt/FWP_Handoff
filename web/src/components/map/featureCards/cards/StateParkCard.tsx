/**
 * @file StateParkCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for Montana State Parks.
 *              Rebuilt from the actual FWP MapServer schema (probed Jun 5):
 *
 *                NAME, ACRES, FWPREG, CAMPING, BOAT_FAC, HUNTING,
 *                HUNT_ACCESS, WEB_PAGE, PDFMAP
 *
 *              The v1 implementation referenced phantom fields (PHONE,
 *              ADDRESS, FEE, DESCRIPTION, ACTIVITIES, SWIMMING, ADA) that
 *              don't actually ship from the service — they always rendered
 *              empty in production. Replaced with a real first-question
 *              hierarchy:
 *
 *                1. Park name + camping availability (MetricCallout) —
 *                   "Reserve a campsite" is the #1 user job.
 *                2. Acres (hero, park domain)
 *                3. Camp / Boat / Hunt badges with success/danger intent
 *                4. Boat facilities detail (BOAT_FAC carries rich text:
 *                   "Marina, Ramp (Concrete), Hookup, Dock")
 *                5. Related links (LinkRow)
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-06
 * @version 2.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ExternalLink, FileText, Navigation } from "lucide-react";
import {
  HeroBlock,
  MetricGrid,
  MetricPill,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { formatExact } from "@/utils/formatNumber";
import { LinkRow } from "@/components/map/featureCards/enrichments/LinkRow";

const STATE_PARKS_CATALOG_URL = "https://stateparks.mt.gov";

const huntingAllowed = (v: string | null): boolean | null => {
  if (!v) return null;
  if (/no\s*hunt|no\s*trap|prohibit/i.test(v)) return false;
  if (/allow|open|permit/i.test(v)) return true;
  return null;
};

const yesNo = (v: string | null): boolean | null => {
  if (!v) return null;
  if (/^y(es)?$/i.test(v.trim())) return true;
  if (/^no?$/i.test(v.trim())) return false;
  return null;
};

const parseBoatFac = (v: string | null): string[] => {
  if (!v) return [];
  if (/no\s*boat/i.test(v)) return [];
  return v
    .split(/[,;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
};

/** Detect the FWP "Boat Facilities Present - Many Types" sentinel — surface
 *  as a generic Yes without trying to split the prose into chips. */
const isManyBoatTypes = (v: string | null): boolean => (v ? /many\s+types/i.test(v) : false);

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const name = str(get("NAME", "Name"));
  const acres = num(get("ACRES", "Acres", "AREA_AC"));
  const region = num(get("FWPREG", "REGION", "Region", "FWP_REGION"));
  const county = str(get("COUNTY", "County"));
  const campRaw = str(get("CAMPING", "Camping"));
  const boatRaw = str(get("BOAT_FAC", "BoatFac"));
  const huntRaw = str(get("HUNTING", "Hunting"));
  const huntAccess = str(get("HUNT_ACCESS", "HuntAccess"));

  const campOk = yesNo(campRaw);
  const huntOk = huntingAllowed(huntRaw);
  const boatFacilities = parseBoatFac(boatRaw);
  const manyBoat = isManyBoatTypes(boatRaw);

  // One stacked fact block, no duplicated activity badges/pills. Each row is
  // shown only when its flag resolves; absence is conveyed by omission (staff
  // feedback: no alarming "No boat" negatives).
  const campingValue = campOk === true ? "Available" : campOk === false ? "Day use only" : null;
  const boatValue = manyBoat
    ? "Many facilities"
    : boatFacilities.length > 0
      ? boatFacilities.join(" · ")
      : null;
  const huntingValue = huntOk === true ? "Allowed" : huntOk === false ? "Not allowed" : null;

  return (
    <>
      {acres !== null ? (
        <HeroBlock caption="State park" value={formatExact(acres, 0)} unit="acres" domain="park" />
      ) : (
        <HeroBlock caption="Montana state park" value={name ?? "State park"} />
      )}
      <MetricGrid stack>
        {campingValue && (
          <MetricPill
            label="Camping"
            value={campingValue}
            intent={campOk === true ? "success" : "default"}
          />
        )}
        {boatValue && <MetricPill label="Boat facilities" value={boatValue} />}
        {huntingValue && (
          <MetricPill
            label="Hunting"
            value={huntingValue}
            intent={huntOk === false ? "warning" : "default"}
          />
        )}
        {region !== null && <MetricPill label="FWP region" value={`${region}`} />}
        {county && <MetricPill label="County" value={county} />}
      </MetricGrid>
      {huntAccess && (
        <TipBlock
          heading="Hunting access"
          intent={/refer|see|consult/i.test(huntAccess) ? "warning" : "info"}
        >
          {huntAccess}
        </TipBlock>
      )}
      {campOk === true && (
        <TipBlock heading="Plan your stay" intent="tip">
          Sites book up months ahead in summer. Reserve via the button below or call ahead for group
          sites. Pack-out leave-no-trace.
        </TipBlock>
      )}
      {/* Staff feedback: the old "No boat ramp" block appeared on parks where
          boating was never a listed activity, presuming carry-in watercraft
          that may not apply. Absence of boat facilities is already conveyed by
          the muted Boat badge above — no negative explainer needed. */}
    </>
  );
};

const Enrichment = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const fwpUrl = str(get("WEB_PAGE", "Web_Page", "WEBPAGE", "URL")) || STATE_PARKS_CATALOG_URL;
  const pdfMap = str(get("PDFMAP", "PDF_MAP", "PdfMap"));
  const lat = num(get("LATITUDE", "Latitude", "lat"));
  const lon = num(get("LONGITUDE", "Longitude", "lon"));
  const directionsUrl =
    lat !== null && lon !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
      : null;
  return (
    <>
      <LinkRow
        variant="primary"
        links={[
          {
            label: fwpUrl === STATE_PARKS_CATALOG_URL ? "stateparks.mt.gov" : "Park webpage",
            href: fwpUrl,
            icon: ExternalLink,
          },
          pdfMap ? { label: "PDF map", href: pdfMap, icon: FileText } : null,
          directionsUrl ? { label: "Directions", href: directionsUrl, icon: Navigation } : null,
        ]}
      />
    </>
  );
};

const stateParkRenderer = {
  summary: (a: Record<string, unknown>) =>
    String(a.NAME ?? a.PARK_NAME ?? a.Name ?? "Montana State Park"),
  subtitle: () => "FWP-managed state park",
  Body,
  detailRoute: (a: Record<string, unknown>) => {
    const id = a.OBJECTID ?? a.objectid ?? a.PARK_ID;
    return id ? `/explore/park/${String(id)}` : null;
  },
  Enrichment,
};

// Both the boundary polygon (`state-parks`) and the centroid point
// (`state-parks-points`) resolve to the same card so a tap on either geometry
// opens the identical popup. Both load under the `engage-mt:state-parks`
// composite.
registerFeature("state-parks", stateParkRenderer);
registerFeature("state-parks-points", stateParkRenderer);
