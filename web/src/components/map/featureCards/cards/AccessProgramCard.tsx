/**
 * @file AccessProgramCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for FWP Public Access Program sites, keyed on
 *              the FWP MapServer schema: OBJECTID, SITE_NAME, ACCESSTYPE
 *              ("Carry-in" / "Walk-in"), LOCATION, WATERBODY, OWNER ("State",
 *              "City of Billings", "County ROW/Private").
 *
 *              The site name leads the card header; the body answers the #1
 *              question ("what kind of access, and who owns it?") with a flat
 *              hero (access type) over a single stacked identity block — owner,
 *              plus waterbody / location only when they differ from the site
 *              name (the service routinely repeats the same string across all
 *              three). Owner-driven TipBlocks add carry-in / easement / sparse-
 *              data context.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 2.0.0
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

/** Map raw OWNER strings to a normalized label + intent. */
const ownerLabel = (
  v: string | null,
): { value: string; intent: "success" | "warning" | "default" } => {
  if (!v) return { value: "Unknown owner", intent: "default" };
  const low = v.toLowerCase();
  if (/state|fwp/i.test(low)) return { value: "State land", intent: "success" };
  if (/feder|usfs|blm|nps/i.test(low)) return { value: "Federal land", intent: "success" };
  if (/city|town|municipal/i.test(low)) return { value: v, intent: "success" };
  if (/county/i.test(low) && /priv/i.test(low)) {
    return { value: "County ROW / private", intent: "warning" };
  }
  if (/county/i.test(low)) return { value: "County land", intent: "success" };
  if (/priv/i.test(low)) return { value: "Private easement", intent: "warning" };
  return { value: v, intent: "default" };
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const name = str(get("SITE_NAME", "NAME", "Name"));
  const accessType = str(get("ACCESSTYPE", "AccessType"));
  const location = str(get("LOCATION", "Location"));
  const waterbody = str(get("WATERBODY", "Waterbody"));
  const owner = str(get("OWNER", "Owner"));

  const ownership = ownerLabel(owner);
  const isCarryIn = accessType ? /carry/i.test(accessType) : false;
  const isWalkIn = accessType ? /walk/i.test(accessType) : false;

  // The user's first question is "what kind of access is this?" — headline it.
  const accessAnswer = isCarryIn
    ? "Carry-in access"
    : isWalkIn
      ? "Walk-in access"
      : (accessType ?? "Public access point");

  // The FWP service routinely ships the same string in SITE_NAME, WATERBODY,
  // and LOCATION. The name already leads the card header, so surface waterbody
  // and location only when they add something the header doesn't.
  const sameAsName = (v: string | null): boolean =>
    !!v && !!name && v.trim().toLowerCase() === name.trim().toLowerCase();
  const showWaterbody = !!waterbody && !sameAsName(waterbody);
  const showLocation =
    !!location &&
    !sameAsName(location) &&
    (!waterbody || location.trim().toLowerCase() !== waterbody.trim().toLowerCase());

  return (
    <>
      <HeroBlock caption="FWP Public Access" value={accessAnswer} />
      <MetricGrid stack>
        {owner && <MetricPill label="Owner" value={ownership.value} intent={ownership.intent} />}
        {showWaterbody && <MetricPill label="Waterbody" value={waterbody} />}
        {showLocation && <MetricPill label="Location" value={location} />}
      </MetricGrid>
      {isCarryIn && (
        <TipBlock heading="Carry-in only" intent="warning">
          No vehicle launch — plan to carry kayaks, canoes, or float tubes from the parking area to
          the water. Distance varies by site.
        </TipBlock>
      )}
      {/county.*priv|priv/i.test(owner ?? "") && (
        <TipBlock heading="Easement on private land" intent="warning">
          This access point sits on a county right-of-way or private easement. Stay within marked
          paths, pack out trash, and respect adjacent landowner postings — easement rights are for
          the specific corridor, not the surrounding parcels.
        </TipBlock>
      )}
      {!waterbody && !accessType && (
        <TipBlock heading="Generic access point" intent="info">
          Limited service-side data for this site. Use the spatial context below to confirm county,
          region, and tribal-jurisdiction context.
        </TipBlock>
      )}
    </>
  );
};

registerFeature("fwp-access-program", {
  // Site name leads the header; the flat hero + stacked identity block carry
  // the rest, so the layer · subtitle · freshness meta-row would only repeat.
  hideMeta: true,
  summary: (a) => String(a.SITE_NAME ?? a.NAME ?? a.Name ?? "Access program point"),
  Body,
});
