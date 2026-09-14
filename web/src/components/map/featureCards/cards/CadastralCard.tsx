/**
 * @file CadastralCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for Montana cadastral parcels.
 *
 *              Schema against the live MSDI Framework
 *              Parcels service. Migrated 2026-07-01 from the retired MSL EMCS
 *              host (gisservicemt.gov) to the ROK-hosted gisservice.mt.gov
 *              (msdi_cadastral_map_v1/MapServer/1); the field schema is
 *              unchanged. The MSDI schema uses
 *              CamelCase MT-Cadastral field names: PARCELID, COUNTYCD,
 *              CountyName, GISAcres, PropType, PropAccess, OwnerName,
 *              OwnerAddress, OwnerCity, OwnerState, OwnerZipcode,
 *              PropertyAddress, PropertyCity, AddressLine1+2, CityStateZip,
 *              LegalDescriptionShort, Subdivision, Township, Range, Section.
 *
 *              Surfaces OwnerName + owner mailing address when
 *              MSDI returns them. Some counties redact OwnerName on
 *              residential parcels per the State Library's PII rules; the
 *              card falls through gracefully with an "Owner information not
 *              published" notice + a county-records link for users who need
 *              to track down ownership through their county clerk.
 *
 *              Agency classification. When the
 *              OwnerName matches a federal / state / tribal pattern, the
 *              card swaps the "private land" framing for an agency-branded
 *              MetricCallout + managed-for label + a suggested Engage MT
 *              layer toggle for the authoritative answer. Agency
 *              precedence follows (FWP > BLM > USFS > USFWS >
 *              NPS > BOR > USACE > DOD > DNRC > University > Tribal >
 *              County > Municipal > Private).
 *
 *              Heavy layer (minScale-bounded); this card surfaces when a
 *              user taps a parcel polygon while zoomed past 1:100k.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-07
 * @version 1.7.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  HeroBlock,
  MetricCallout,
  MetricGrid,
  MetricPill,
  Paragraph,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import { resolveAgency } from "@/components/map/featureCards/core/agencyResolver";
import { NearbyPublicAccessBlock } from "@/components/map/featureCards/enrichments/NearbyPublicAccessBlock";
import { lookupPlssAtPoint } from "@/services/spatialContext/plss";
import type { FeatureRendererProps, TapPoint } from "@/components/map/featureCards/core/types";
import { PillButton } from "@/components/shared/forms/PillButton";

/**
 * Resolve the authoritative PLSS Township/Range/Section at the tapped point.
 * Public + state-trust ground has a blank assessor TRS, so we fall back to this
 * survey-grid lookup. Renders inline in the identity stack (styled like the
 * other pills) rather than as a separate block. Async + non-blocking.
 */
const usePlssTrs = (tapPoint?: TapPoint): string | null => {
  const [trs, setTrs] = useState<string | null>(null);
  useEffect(() => {
    if (!tapPoint) return;
    let cancelled = false;
    void lookupPlssAtPoint(tapPoint.longitude, tapPoint.latitude).then((r) => {
      if (!cancelled) setTrs(r?.trs ?? null);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapPoint?.latitude, tapPoint?.longitude]);
  return trs;
};

const Body = ({ attrs, tapPoint }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const parcelId = str(get("PARCELID", "PARCEL_ID", "ParcelId", "PROPERTY_ID"));
  const county = str(get("CountyName", "COUNTY", "County"));
  const acres = num(get("GISAcres", "TotalAcres", "ACRES", "Acres", "TOTAL_ACRES"));
  const propType = str(get("PropType", "OWNER_TYPE", "OwnerType"));
  const propAccess = str(get("PropAccess", "PROP_ACCESS"));
  const ownerName = str(get("OwnerName", "OWNER_NAME"));
  const propertyAddress = str(get("PropertyAddress", "AddressLine1", "ADDRESS"));
  const propertyCity = str(get("PropertyCity"));
  const addressLine2 = str(get("AddressLine2"));
  const cityStateZip = str(get("CityStateZip"));
  const legalDesc = str(get("LegalDescriptionShort", "LegalDescription"));
  const subdivision = str(get("Subdivision"));
  const township = str(get("Township"));
  const range = str(get("Range"));
  const section = str(get("Section"));

  // Port the agency precedence into the cadastral pipeline.
  // The match drives every framing decision below; null means we have no
  // ownership signal at all, which is rare (MSDI almost always ships
  // PropType even when OwnerName is PII-redacted).
  const agency = resolveAgency(ownerName, propType);
  const isUndetermined = agency?.agency === "UNDETERMINED";
  // Undetermined ownership is treated as private for every warning below.
  const isPrivate = !agency || agency.isPrivate || isUndetermined;
  const isStateTrust = agency?.isTrust === true;
  const isTribal = agency?.isTribal === true;
  const _isAgencyPublic = !!agency && agency.isPublic && !agency.isTrust;
  void _isAgencyPublic;

  const propertyAddressFull = [
    propertyAddress ?? null,
    propertyCity ?? null,
    addressLine2 ?? null,
    cityStateZip ?? null,
  ]
    .filter(Boolean)
    .join(", ");

  // Intent for the ownership pill mirrors the agency framing:
  //  - public (federal / state non-trust) → success (green)
  //  - state trust + tribal → warning (amber) — extra caution needed
  //  - private → warning (orange)
  const ownershipIntent: "success" | "warning" | "default" = agency
    ? agency.isTribal || agency.isTrust || agency.isPrivate
      ? "warning"
      : "success"
    : "default";

  // Assessor TRS when the parcel carries it, else the authoritative PLSS survey
  // grid at the tapped point (public + state-trust ground ships a blank assessor
  // TRS). Rendered as a plain pill in the stack, directly under Parcel id.
  const assessorTrs =
    township || range || section
      ? `${township ?? ""}${range ? " " + range : ""}${section ? " Sec " + section : ""}`.trim()
      : null;
  const asyncPlss = usePlssTrs(tapPoint);
  const plssTrs = assessorTrs ?? asyncPlss;

  return (
    <>
      {/* Public / agency parcels lead with the agency callout (it carries the
          ownership framing, so no separate acreage hero or ownership row);
          private + other parcels lead with the owner / area hero. */}
      {agency && !isPrivate ? (
        <MetricCallout
          title={
            isTribal ? "Tribal jurisdiction" : isStateTrust ? "State trust land" : "Public land"
          }
          value={agency.label}
          sub={agency.managedFor}
          intent={isTribal || isStateTrust ? "warning" : "success"}
        />
      ) : isUndetermined ? (
        <HeroBlock
          caption={
            county ? `Ownership not determined · ${county} County` : "Ownership not determined"
          }
          value={ownerName ?? propType ?? "Owner on record"}
        />
      ) : isPrivate && ownerName ? (
        <HeroBlock
          caption={county ? `Private parcel · ${county} County` : "Private parcel"}
          value={ownerName}
        />
      ) : acres !== null ? (
        <HeroBlock
          caption={agency?.label ?? (county ? `${county} County parcel` : "Parcel")}
          value={acres.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          unit="ac"
        />
      ) : (
        <HeroBlock caption="Montana cadastral parcel" value={parcelId ?? "Parcel"} />
      )}
      {/* One stacked identity block. Ownership is omitted when the callout above
          already names the managing agency; PLSS sits right under the parcel id
          in the same plain pill format. */}
      <MetricGrid stack>
        {agency && isPrivate && !isUndetermined && (
          <MetricPill label="Ownership" value={agency.label} intent={ownershipIntent} />
        )}
        {acres !== null && (
          <MetricPill
            label="Area"
            value={`${acres.toLocaleString(undefined, { maximumFractionDigits: 1 })} ac`}
          />
        )}
        {county && <MetricPill label="County" value={county} />}
        {propAccess && <MetricPill label="Legal access" value={propAccess} />}
        {parcelId && <MetricPill label="Parcel id" value={parcelId} />}
        {plssTrs && <MetricPill label="Survey location (PLSS)" value={plssTrs} />}
        {propertyAddressFull && <MetricPill label="Property address" value={propertyAddressFull} />}
        {subdivision && <MetricPill label="Subdivision" value={subdivision} />}
      </MetricGrid>

      {legalDesc && (
        <TipBlock heading="Legal description" intent="info">
          {legalDesc}
        </TipBlock>
      )}

      {/* State trust land — SRUL block (preserved from prior phases). */}
      {isStateTrust && (
        <TipBlock heading="State trust land — SRUL required" intent="warning">
          <Paragraph>
            Recreation on Montana state trust land needs a State Recreational Use License (SRUL) —
            $13/year from DNRC. Without it, every step is trespassing. Hunting + fishing licenses
            already include SRUL coverage for those activities.
          </Paragraph>
          <PillButton
            variant="primary"
            iconEnd={ExternalLink}
            onClick={() =>
              window.open("https://dnrc.mt.gov/Trust-Land/Recreation", "_blank", "noopener")
            }
          >
            Buy an SRUL
          </PillButton>
        </TipBlock>
      )}

      {/* Tribal jurisdiction warning. */}
      {isTribal && (
        <TipBlock heading="Tribal jurisdiction" intent="warning">
          <Paragraph>
            This parcel is under tribal sovereign jurisdiction. State + federal hunting / fishing /
            recreation permits don&rsquo;t apply on tribal land. Contact the appropriate tribal
            office before entering.
          </Paragraph>
        </TipBlock>
      )}

      {/* Private-land warning with the Montana
          Stream Access Law sentence (angler-first framing). */}
      {isUndetermined && (
        <TipBlock heading="Ownership not determined" intent="warning">
          The owner on record could not be classified as public or private. Treat this parcel as
          private until you confirm it with the county assessor or the Public Lands layer.
        </TipBlock>
      )}
      {isPrivate && (
        <TipBlock heading="Private land" intent="warning">
          Private property — permission required to enter. Montana&rsquo;s Stream Access Law lets
          you wade and float navigable waters below the ordinary high-water mark, but crossing
          private land to reach the stream requires the landowner&rsquo;s permission.
        </TipBlock>
      )}
    </>
  );
};

// NearbyPublicAccessBlock when the parcel is private
// or tribal (the two scenarios where "what can I actually do nearby?" is
// the user's next question). For public-agency hits the dedicated agency
// layers + the agency-suggested layer toggle cover the gap.
const Enrichment = ({ attrs, tapPoint }: FeatureRendererProps): JSX.Element | null => {
  const get = pick(attrs);
  const ownerName = str(get("OwnerName", "OWNER_NAME"));
  const propType = str(get("PropType", "OWNER_TYPE", "OwnerType"));
  const agency = resolveAgency(ownerName, propType);
  const showNearby = !agency || agency.isPrivate || agency.isTribal;
  return <>{showNearby && <NearbyPublicAccessBlock tapPoint={tapPoint} />}</>;
};

registerFeature("mt-cadastral", {
  // The body's ownership hero + pills carry the parcel identity — the
  // header (badge + "Parcel N" + provenance strip) repeated it.
  hideHeader: true,
  summary: (a) => {
    const pid = a.PARCELID ?? a.PARCEL_ID ?? a.ParcelId ?? a.PROPERTY_ID;
    if (pid) return `Parcel ${pid}`;
    return "Parcel";
  },
  subtitle: (a) => {
    const county = a.CountyName ?? a.COUNTY ?? a.County;
    return county ? `${county} County · Montana cadastral parcel` : "Montana cadastral parcel";
  },
  Body,
  Enrichment,
});
