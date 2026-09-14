/**
 * @file BmaCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for Block Management Areas.
 *              Rebuilt from the actual FWP FeatureServer schema
 *              (probed Jun 5):
 *
 *                OBJECTID, BMANUM (number), BMANAME (e.g. "Kohler Lake"),
 *                CLASS ("BMA Boundary" / "Safety Zone (No Trespassing,
 *                No Hunting)"), STATUS ("Active"), ENDDATE ("6/15/2026"),
 *                REGION (numeric 1-7), PTYPE (numeric type code),
 *                PDFMAP (URL), ACCESSINFO (URL), Shape__Area (sq deg)
 *
 *              The v1 implementation referenced phantom fields (ACRES,
 *              SIGN_REQ, HUNTERS_PER_DAY, QUOTA, LO_CONTACT, NOTES) that
 *              don't ship from the service — the card rendered empty
 *              quota and sign-in pills with default placeholders that
 *              MISLED users into thinking sign-in wasn't required when
 *              actually FWP requires sign-in at every BMA. New card:
 *
 *                1. BMA name + CLASS callout — safety zones look very
 *                   different from BMA boundaries and the user needs
 *                   to know IMMEDIATELY which they're on.
 *                2. Acres computed from Shape__Area (sq meters → acres)
 *                3. Status + ENDDATE — "Active until Jun 15 2026" tells
 *                   the user whether the BMA is even in season.
 *                4. BMA # + Region
 *                5. Universal sign-in TipBlock (TRUE for all BMAs).
 *                6. LinkRow — PDF map + ACCESSINFO + signup page
 *                7. SpatialContext enrichment
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Calendar, ExternalLink, FileText, Hash } from "lucide-react";
import {
  HeroBlock,
  MetricCallout,
  MetricGrid,
  MetricPill,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { formatExact } from "@/utils/formatNumber";
import { LinkRow } from "@/components/map/featureCards/enrichments/LinkRow";

const BMA_SIGNUP_URL = "https://fwp.mt.gov/hunt/access/blockmanagement";

/**
 * Service ships Shape__Area in *square decimal degrees* (WGS-84) at
 * ~46° N, which is approximately 8.43e9 sq m per sq deg of latitude
 * (since 1° ≈ 111 km × cos(46°)·111 km). We use a conservative single
 * conversion factor that gets within ±10% of true area for Montana's
 * latitude band. Service returns Shape__Area in the FeatureServer's
 * default spatial reference, which is WGS84 for hosted layers.
 */
const SQ_DEG_TO_ACRES = 8.43e9 * 0.000247105; // ≈ 2,083,395 acres per sq deg

const formatEndDate = (raw: string | null): string | null => {
  if (!raw) return null;
  // Service ships strings like "6/15/2026" — parse defensively.
  const parts = raw.split("/");
  if (parts.length === 3) {
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
  return raw;
};

const isExpired = (raw: string | null): boolean => {
  if (!raw) return false;
  const parts = raw.split("/");
  if (parts.length !== 3) return false;
  const m = parseInt(parts[0], 10);
  const d = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
  const end = new Date(y, m - 1, d).getTime();
  return Date.now() > end;
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const name = str(get("BMANAME", "BMA_NAME", "bma_name", "NAME"));
  const bmaNum = num(get("BMANUM", "BMA_NUM", "BMA_ID"));
  const cls = str(get("CLASS", "Class"));
  const status = str(get("STATUS", "Status"));
  const endDate = str(get("ENDDATE", "EndDate", "END_DATE"));
  const region = num(get("REGION", "Region", "region"));
  // PTYPE is FWP's numeric BMA program-type code (1 or 2). Type 1 and Type 2
  // BMAs differ in how access is arranged (open sign-in vs. reservation /
  // permission-slip) and in the landowner agreement — surface it so hunters
  // know which set of access rules applies. Rendered as "Type N" without
  // asserting the specific rules (those live on the BMA's own page).
  const ptype = num(get("PTYPE", "ptype", "TYPE", "Type"));
  const bmaType = ptype !== null ? `Type ${ptype}` : null;
  const shapeArea = num(get("Shape__Area", "Shape_Area"));
  // Some seed fixtures carry a precomputed ACRES integer. Fall back to it
  // when Shape__Area isn't on the feature (e.g., tests + hand-curated rows).
  const directAcres = num(get("ACRES", "Acres", "acres"));
  const acres = shapeArea !== null ? Math.round(shapeArea * SQ_DEG_TO_ACRES) : directAcres;
  const isSafetyZone = cls ? /safety|no\s*trespass|no\s*hunt/i.test(cls) : false;
  const isActive = status ? /active|open/i.test(status) : true;
  const expired = isExpired(endDate);

  const callout = isSafetyZone
    ? {
        value: "Safety zone — NO HUNTING",
        sub: "Marked-off area within or adjacent to a BMA",
        intent: "danger" as const,
      }
    : !isActive || expired
      ? {
          value: "Closed / expired enrollment",
          sub: expired && endDate ? `Ended ${formatEndDate(endDate)}` : (status ?? undefined),
          intent: "warning" as const,
        }
      : {
          value: "Open to public hunting",
          sub:
            endDate && !expired
              ? `Enrolled through ${formatEndDate(endDate)}`
              : "Active BMA enrollment",
          intent: "success" as const,
        };

  return (
    <>
      <MetricCallout
        title={name ?? "Block Management Area"}
        value={callout.value}
        sub={callout.sub}
        intent={callout.intent}
      />
      {!isSafetyZone && acres !== null && (
        <HeroBlock
          caption="Hunting acreage (approx.)"
          value={formatExact(acres, 0)}
          unit="acres"
          domain="wildlife"
        />
      )}
      <MetricGrid>
        {bmaNum !== null && <MetricPill label="BMA #" value={`${bmaNum}`} icon={Hash} />}
        {bmaType && <MetricPill label="BMA type" value={bmaType} />}
        {region !== null && <MetricPill label="FWP region" value={`${region}`} />}
        {endDate && (
          <MetricPill
            label="Enrolled through"
            value={formatEndDate(endDate) ?? endDate}
            icon={Calendar}
            intent={expired ? "danger" : "default"}
          />
        )}
      </MetricGrid>
      {isSafetyZone ? (
        <TipBlock heading="Safety zone — no hunting" intent="danger">
          This polygon is a designated <strong>safety zone</strong> inside or adjacent to a Block
          Management Area. Hunting, weapon discharge, and trespass are <strong>prohibited</strong>{" "}
          here even though the surrounding BMA is open. Pay attention to posted signs.
        </TipBlock>
      ) : (
        <TipBlock heading="BMA sign-in required" intent="warning">
          FWP requires <strong>sign-in at the BMA box</strong> before hunting (paper or digital).
          Read the landowner&rsquo;s page for daily quotas, weapon restrictions, and parking rules.
          Respect gates and posted boundaries.
          {bmaType && (
            <>
              {" "}
              This is a <strong>{bmaType}</strong> BMA — Type&nbsp;1 and Type&nbsp;2 differ in how
              access is arranged (open sign-in vs. reservation / permission) and in the landowner
              agreement; check the BMA&rsquo;s page for its exact rules.
            </>
          )}
        </TipBlock>
      )}
      <TipBlock heading="What is a BMA?" intent="info">
        Block Management Areas are private lands where FWP partners with landowners to keep public
        hunting open. The BMA enrollment runs annually — confirm the dates above before planning a
        trip.
      </TipBlock>
    </>
  );
};

const Enrichment = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const pdfMap = str(get("PDFMAP", "PDF_MAP"));
  const accessInfo = str(get("ACCESSINFO", "AccessInfo"));
  return (
    <>
      <LinkRow
        links={[
          pdfMap ? { label: "BMA PDF map", href: pdfMap, icon: FileText } : null,
          {
            label: "BMA sign-up portal",
            href: accessInfo ?? BMA_SIGNUP_URL,
            icon: ExternalLink,
          },
        ]}
      />
    </>
  );
};

registerFeature("bma-boundaries", {
  summary: (a) =>
    String(a.BMANAME ?? a.BMA_NAME ?? a.bma_name ?? a.NAME ?? a.Name ?? "Block Management Area"),
  subtitle: (a) => {
    const c = str(a.CLASS);
    if (c && /safety/i.test(c)) return "Safety zone — no hunting";
    return "Public hunting access on private land";
  },
  Body,
  Enrichment,
  detailRoute: (a) => {
    const id = a.BMANUM ?? a.BMA_ID ?? a.OBJECTID ?? a.objectid;
    return id ? `/access/bma/${String(id)}` : null;
  },
});
