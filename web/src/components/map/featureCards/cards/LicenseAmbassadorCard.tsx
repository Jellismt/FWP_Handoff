/**
 * @file LicenseAmbassadorCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for FWP license-ambassador locations
 *              (ADMBND_FWP_LICENSE_AMBASSADORS) — local businesses with an FWP
 *              station where you can buy a license in person. Leads with the
 *              business name, then city / phone, and call / website / directions
 *              actions.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ExternalLink, Navigation } from "lucide-react";
import {
  MetricCallout,
  MetricGrid,
  MetricPill,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { LinkRow, type LinkRowLink } from "@/components/map/featureCards/enrichments/LinkRow";

const AMBASSADOR_PAGE_URL = "https://fwp.mt.gov/buyandapply/license-ambassadors";

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const name = str(get("BUSINESS_NAME", "NAME", "Name"));
  const address = str(get("BUSINESS_ADDRESS", "ADDRESS"));
  const city = str(get("BUSINESS_CITY", "CITY"));
  const state = str(get("BUSINESS_STATE", "STATE"));
  const phone = str(get("CONTACT_PHONE", "PHONE"));
  const extra = str(get("EXTRA_INFO", "ExtraInfo"));

  return (
    <>
      <MetricCallout
        title="License ambassador"
        value={name ?? "License provider"}
        sub={city ? `${city}${state ? `, ${state}` : ""}` : "Buy a license in person"}
        intent="success"
      />
      <MetricGrid stack>
        {address && <MetricPill label="Address" value={address} />}
        {phone && <MetricPill label="Phone" value={phone} />}
        {extra && <MetricPill label="Notes" value={extra} />}
      </MetricGrid>
    </>
  );
};

const buildLinks = (props: FeatureRendererProps): readonly (LinkRowLink | null)[] => {
  const get = pick(props.attrs);
  const lat = num(get("Y", "LATITUDE", "latitude")) ?? props.tapPoint?.latitude ?? null;
  const lon = num(get("X", "LONGITUDE", "longitude")) ?? props.tapPoint?.longitude ?? null;
  const directionsUrl =
    lat !== null && lon !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
      : null;
  return [
    // The phone number is already a pill in the body — a Call link duplicated it.
    directionsUrl ? { label: "Directions", href: directionsUrl, icon: Navigation } : null,
    { label: "About license ambassadors", href: AMBASSADOR_PAGE_URL, icon: ExternalLink },
  ];
};

const Enrichment = (props: FeatureRendererProps): JSX.Element | null => (
  <LinkRow links={buildLinks(props)} />
);

registerFeature("license-ambassadors", {
  // The meta-row repeated the hero (name · town · buy-a-license · freshness).
  hideMeta: true,
  // The FWP ambassador feed lists some vendors twice at the same spot, so a
  // single tap can return identical sibling features. Collapse them to one card.
  collapseDuplicatesAtTap: true,
  summary: (a) => String(a.BUSINESS_NAME ?? a.NAME ?? a.Name ?? "License Ambassador"),
  subtitle: (a) => {
    const c = str(a.BUSINESS_CITY ?? a.CITY);
    return c ? `${c} · Buy a license here` : "Buy a license in person";
  },
  Body,
  Enrichment,
});
