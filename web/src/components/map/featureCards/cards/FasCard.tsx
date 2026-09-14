/**
 * @file FasCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for Fishing Access Sites.
 *              Rebuilt from the actual FWP MapServer schema (probed Jun 5):
 *
 *                NAME, ACRES, WEB_PAGE, BOAT_FAC ("Dock, Ramp (Concrete)"),
 *                CAMPING ("Yes"/"No"), HUNTING ("NO HUNTING"/...),
 *                HUNT_ACCESS, PDFMAP, LATITUDE, LONGITUDE, LMS_ID
 *
 *              The v1 implementation referenced phantom fields (REGION,
 *              COUNTY, WATERBODY, AMENITIES, DESCRIPTION, RESTROOM,
 *              DRINKING_WATER, FISHING_PIER, DOCK, PICNIC, SWIMMING) that
 *              don't ship from the FAS service — they always rendered
 *              empty. Replaced with a real first-question hierarchy:
 *
 *                1. Launch type (MetricCallout) — "Concrete ramp",
 *                   "Carry-in only", "No facilities" — anglers want this
 *                   above the fold.
 *                2. Acres (hero, fish domain)
 *                3. Boat / Camp / Hunt activity badges
 *                4. Boat facilities split as BadgeRow
 *                5. Related links (LinkRow)
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-07
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Anchor, Check, ExternalLink, FileText, Navigation, Tent, X } from "lucide-react";
import {
  BadgeRow,
  HeroBlock,
  MetricCallout,
  MetricGrid,
  MetricPill,
  TipBlock,
  type BadgeItem,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { formatExact } from "@/utils/formatNumber";
import { LinkRow, type LinkRowLink } from "@/components/map/featureCards/enrichments/LinkRow";

const FAS_CATALOG_URL = "https://fwp.mt.gov/activities/recreation/fishing-access-sites";

const yesNo = (v: string | null): boolean | null => {
  if (!v) return null;
  if (/^y(es)?$/i.test(v.trim())) return true;
  if (/^no?$/i.test(v.trim())) return false;
  return null;
};

const huntingAllowed = (v: string | null): boolean | null => {
  if (!v) return null;
  if (/no\s*hunt|no\s*trap|prohibit/i.test(v)) return false;
  if (/allow|open|permit/i.test(v)) return true;
  return null;
};

/** "Dock, Ramp (Concrete)" → ["Dock", "Ramp (Concrete)"] */
const parseBoatFac = (v: string | null): string[] => {
  if (!v) return [];
  if (/no\s*boat|no\s*facilities/i.test(v)) return [];
  return v
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
};

/** Summarize the launch type for the hero callout. */
const launchSummary = (
  boatFacs: string[],
): { value: string; intent: "success" | "warning" | "default" } => {
  if (boatFacs.length === 0) return { value: "Carry-in only", intent: "warning" };
  const joined = boatFacs.join(" ").toLowerCase();
  if (joined.includes("concrete")) return { value: "Concrete ramp", intent: "success" };
  if (joined.includes("gravel")) return { value: "Gravel ramp", intent: "success" };
  if (joined.includes("ramp")) return { value: "Boat ramp", intent: "success" };
  if (joined.includes("dock")) return { value: "Dock access", intent: "success" };
  return { value: boatFacs.join(", "), intent: "default" };
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const name = str(get("NAME", "Name"));
  const acres = num(get("ACRES", "Acres"));
  const boatRaw = str(get("BOAT_FAC", "BoatFac", "BOAT_RAMP", "BoatRamp"));
  const campRaw = str(get("CAMPING", "Camping"));
  const huntRaw = str(get("HUNTING", "Hunting"));
  const huntAccess = str(get("HUNT_ACCESS", "HuntAccess"));
  const waterbody = str(get("WATERBODY", "Waterbody", "WATER_BODY"));

  const boatFacilities = parseBoatFac(boatRaw);
  const hasBoat = boatFacilities.length > 0;
  const campOk = yesNo(campRaw);
  const huntOk = huntingAllowed(huntRaw);
  const launch = launchSummary(boatFacilities);

  // First-question MetricCallout — anglers tap a FAS pin asking "what
  // kind of launch is here?" Lead with that.
  const launchCalloutSub =
    hasBoat && boatFacilities.length > 1
      ? boatFacilities.join(" + ")
      : campOk === true
        ? "Camping available"
        : campOk === false
          ? "Day use only"
          : undefined;

  const activityBadges: BadgeItem[] = [
    {
      icon: hasBoat ? Check : X,
      label: "Boat",
      intent: hasBoat ? "success" : "danger",
    },
    {
      icon: campOk === true ? Check : X,
      label: "Camp",
      intent: campOk === true ? "success" : campOk === false ? "danger" : "default",
    },
    {
      icon: huntOk === true ? Check : X,
      label: "Hunt",
      intent: huntOk === true ? "success" : huntOk === false ? "danger" : "default",
    },
  ];

  // Suppress the boilerplate "refer to current regulations" notice when
  // we already have a definitive hunting flag — it only adds noise.
  const huntAccessIsBoilerplate = huntAccess
    ? /refer|see|consult/i.test(huntAccess) && huntOk !== null
    : false;

  return (
    <>
      <MetricCallout
        title={name ?? "Fishing Access Site"}
        value={launch.value}
        sub={launchCalloutSub}
        intent={launch.intent}
      />
      {acres !== null && (
        <HeroBlock
          caption="Public access"
          value={formatExact(acres, 1)}
          unit="acres"
          domain="fish"
        />
      )}
      <BadgeRow label="Allowed uses" badges={activityBadges} />
      <MetricGrid>
        {hasBoat && (
          <MetricPill
            label="Launch"
            value={`${boatFacilities.length} type${boatFacilities.length === 1 ? "" : "s"}`}
            icon={Anchor}
            intent="success"
          />
        )}
        {campOk === true && (
          <MetricPill label="Camping" value="Allowed" icon={Tent} intent="success" />
        )}
        {campOk === false && <MetricPill label="Camping" value="No" icon={Tent} intent="warning" />}
      </MetricGrid>
      {hasBoat && boatFacilities.length > 0 && (
        <BadgeRow label="Boat ramp" badges={boatFacilities} />
      )}
      {waterbody && (
        <MetricGrid>
          <MetricPill label="Waterbody" value={waterbody} />
        </MetricGrid>
      )}
      {huntOk === false && (
        <TipBlock heading="No hunting at this site" intent="warning">
          This FAS is angling-only. Discharge of firearms or bow weapons is prohibited within the
          site boundary. Surrounding land may have different rules — confirm with the spatial
          context below.
        </TipBlock>
      )}
      {huntAccess && !huntAccessIsBoilerplate && (
        <TipBlock heading="Hunting access" intent="info">
          {huntAccess}
        </TipBlock>
      )}
      {/* Staff-requested disclaimer: a Conservation License is
          required to use FWP-owned fishing access sites. */}
      <TipBlock heading="Conservation License required" intent="warning">
        A current Conservation License is required to use FWP Fishing Access Sites. It&rsquo;s
        included with a hunting or fishing license; otherwise buy it from FWP before you go.
      </TipBlock>
    </>
  );
};

/** link row: FWP page · PDF map · directions. */
const buildFasLinks = (attrs: FeatureRendererProps["attrs"]): readonly (LinkRowLink | null)[] => {
  const get = pick(attrs);
  const fwpUrl = str(get("WEB_PAGE", "Web_Page", "WEBPAGE", "URL")) || FAS_CATALOG_URL;
  const pdfMap = str(get("PDFMAP", "PDF_MAP", "PdfMap"));
  const lat = num(get("LATITUDE", "Latitude", "lat"));
  const lon = num(get("LONGITUDE", "Longitude", "lon"));
  const directionsUrl =
    lat !== null && lon !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
      : null;
  return [
    {
      label: fwpUrl === FAS_CATALOG_URL ? "FAS catalog at fwp.mt.gov" : "FWP page",
      href: fwpUrl,
      icon: ExternalLink,
    },
    pdfMap ? { label: "PDF map", href: pdfMap, icon: FileText } : null,
    directionsUrl ? { label: "Directions", href: directionsUrl, icon: Navigation } : null,
  ];
};

// The Enrichment slot always renders the link row so users have the FWP
// page + PDF map + directions.
const LinksEnrichment = ({ attrs }: FeatureRendererProps): JSX.Element => (
  <LinkRow links={buildFasLinks(attrs)} />
);

const fasRenderer = {
  summary: (a: Record<string, unknown>) =>
    String(a.NAME ?? a.Name ?? a.name ?? "Fishing Access Site"),
  subtitle: () => "FWP-managed angler access",
  Body,
  Enrichment: LinksEnrichment,
};

// Both the centroid point (`fishing-access-sites`) and the boundary polygon
// (`fas-boundaries`) resolve to the same card so a tap on either geometry opens
// the identical popup. Both load under the `engage-mt:fishing-access-sites`
// composite.
registerFeature("fishing-access-sites", fasRenderer);
registerFeature("fas-boundaries", fasRenderer);
