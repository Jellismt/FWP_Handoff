/**
 * @file WmaCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for Wildlife Management Areas.
 *              Rebuilt from the actual FWP MapServer schema (probed Jun 5):
 *
 *                NAME, ACRES, FWPREG, HUNTING, CAMPING, BOAT_FAC,
 *                HUNT_ACCESS, WEB_PAGE, PDFMAP
 *
 *              The popup leads with the user's first-question hierarchy:
 *
 *                1. Can I hunt here? (HUNTING — "HUNTING ALLOWED" vs
 *                   "NO HUNTING/NO TRAPPING") — intent-colored MetricCallout
 *                2. Acres (hero, wildlife domain)
 *                3. Hunt / Camp / Boat icons with success/danger intent
 *                4. Access type (HUNT_ACCESS — walk-in vs vehicle)
 *                5. Boat facilities detail (BOAT_FAC parsed)
 *                6. Region · acreage metrics
 *                7. LinkRow enrichment
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-07
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
  ExplainerNote,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { formatExact } from "@/utils/formatNumber";
import { LinkRow } from "@/components/map/featureCards/enrichments/LinkRow";

const WMA_CATALOG_URL = "https://fwp.mt.gov/conservation/habitat/wildlife-management-areas";

/** "HUNTING ALLOWED" → true. "NO HUNTING/NO TRAPPING" → false. Defensive. */
const huntingAllowed = (v: string | null): boolean | null => {
  if (!v) return null;
  if (/no\s*hunt|no\s*trap|prohibit/i.test(v)) return false;
  if (/allow|open|permit/i.test(v)) return true;
  return null;
};

/** "Yes" / "No" → boolean | null. */
const yesNo = (v: string | null): boolean | null => {
  if (!v) return null;
  if (/^y(es)?$/i.test(v.trim())) return true;
  if (/^no?$/i.test(v.trim())) return false;
  return null;
};

/** "Marina, Ramp (Concrete)" → split for chip rendering. */
const parseBoatFac = (v: string | null): string[] => {
  if (!v) return [];
  if (/no\s*boat/i.test(v)) return [];
  return v
    .split(/[,;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const name = str(get("NAME", "Name"));
  const acres = num(get("ACRES", "Acres", "AREA_AC"));
  const region = num(get("FWPREG", "REGION", "Region", "FWP_REGION"));
  const huntRaw = str(get("HUNTING", "Hunting"));
  const campRaw = str(get("CAMPING", "Camping"));
  const boatRaw = str(get("BOAT_FAC", "BoatFac"));
  const huntAccess = str(get("HUNT_ACCESS", "HuntAccess"));
  const purpose = str(get("PURPOSE", "Purpose"));

  const huntOk = huntingAllowed(huntRaw);
  const campOk = yesNo(campRaw);
  const boatFacilities = parseBoatFac(boatRaw);
  const hasBoat = boatFacilities.length > 0;

  // Walk-in vs drive-in inferred from HUNT_ACCESS prose.
  const walkInOnly = huntAccess ? /walk[- ]in/i.test(huntAccess) : null;
  // "Refer to current ... regulations" is a regulatory-deferral that we
  // want to call out distinctly from a specific access rule.
  const referToRegs = huntAccess ? /refer|consult|see\s+current/i.test(huntAccess) : false;

  // One stacked fact block — no duplicated activity badges/pills. Each row
  // renders only when its flag resolves.
  const huntingValue =
    huntOk === true ? "Allowed" : huntOk === false ? "Not allowed" : "Check current regulations";
  const accessValue =
    walkInOnly === true
      ? "Walk-in only"
      : walkInOnly === false && huntAccess && !referToRegs
        ? "Vehicle access"
        : null;
  const campingValue =
    campOk === true ? "Dispersed allowed" : campOk === false ? "Not allowed" : null;
  const boatValue = hasBoat ? boatFacilities.join(" · ") : null;

  return (
    <>
      {acres !== null ? (
        <HeroBlock
          caption="Wildlife habitat"
          value={formatExact(acres, 0)}
          unit="acres"
          domain="wildlife"
        />
      ) : (
        <HeroBlock caption="Wildlife management area" value={name ?? "WMA"} />
      )}
      <ExplainerNote>
        Wildlife Management Areas are FWP-owned land managed primarily for wildlife. Open for
        hunting, fishing, and most recreation, but many have seasonal closures (Dec–May is common)
        to protect wintering elk or nesting raptors — check the access notes before you go.
      </ExplainerNote>
      <MetricGrid stack>
        <MetricPill
          label="Hunting"
          value={huntingValue}
          intent={huntOk === true ? "success" : huntOk === false ? "warning" : "default"}
        />
        {accessValue && (
          <MetricPill
            label="Access"
            value={accessValue}
            intent={walkInOnly === true ? "warning" : "default"}
          />
        )}
        {campingValue && <MetricPill label="Camping" value={campingValue} />}
        {boatValue && <MetricPill label="Boat facilities" value={boatValue} />}
        {region !== null && <MetricPill label="FWP region" value={`${region}`} />}
      </MetricGrid>
      {purpose && (
        <TipBlock heading="Habitat purpose" intent="info">
          {purpose}
        </TipBlock>
      )}
      {huntAccess && referToRegs && (
        <TipBlock heading="Regulation pointer" intent="warning">
          {huntAccess} Open the current hunting regulations or tap the FWP webpage below for
          species-by-species rules on this WMA.
        </TipBlock>
      )}
      {huntAccess && !referToRegs && walkInOnly !== true && (
        <TipBlock heading="Access notes" intent="info">
          {huntAccess}
        </TipBlock>
      )}
    </>
  );
};

const Enrichment = (props: FeatureRendererProps): JSX.Element => {
  const { attrs } = props;
  const get = pick(attrs);
  const fwpUrl = str(get("WEB_PAGE", "Web_Page", "WEBPAGE", "URL")) || WMA_CATALOG_URL;
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
            label: fwpUrl === WMA_CATALOG_URL ? "WMA catalog at fwp.mt.gov" : "WMA webpage",
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

const wmaRenderer = {
  summary: (a: Record<string, unknown>) =>
    String(a.NAME ?? a.WMA_NAME ?? a.Name ?? "Wildlife Management Area"),
  subtitle: () => "FWP-managed wildlife habitat",
  Body,
  detailRoute: (a: Record<string, unknown>) => {
    const id = a.OBJECTID ?? a.objectid ?? a.WMA_ID;
    return id ? `/explore/wma/${String(id)}` : null;
  },
  Enrichment,
};

// Both the boundary polygon (`wildlife-management-areas`) and the centroid
// point (`wma-points`) resolve to the same card so a tap on either geometry
// opens the identical popup. Both load under the `engage-mt:wmas` composite.
registerFeature("wildlife-management-areas", wmaRenderer);
registerFeature("wma-points", wmaRenderer);
