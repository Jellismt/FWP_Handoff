/**
 * @file BlmRecCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for BLM recreation sites,
 *              now harmonized with BorRecCard + UsfsRecCard so the three
 *              cards under the `federal-recreation-sites` composite read
 *              as one design language. Slot order is locked across all
 *              three; per-agency cards only differ where the upstream
 *              schema differs.
 *
 *              FWP-via-BLM MapServer schema (probed Jun 5):
 *
 *                OBJECTID, DESCRIPTIO (name), LAUNCH, FISHING ("Y"/null)
 *
 *              Shared slot order (BLM fills the slots its sparse schema
 *              can support; the rest stay empty):
 *
 *                1. MetricCallout — site name + inferred type + agency sub
 *                2. DomainPill row — n/a for BLM
 *                3. MetricGrid amenity pills — Launch / Fishing
 *                4. Description Paragraph — n/a for BLM
 *                5. TipBlock — dispersed camping context
 *                6. Link enrichment (BLM page
 *                   facility deep-link on match + Directions)
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-07-14
 * @version 2.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ExternalLink } from "lucide-react";
import {
  HeroBlock,
  MetricGrid,
  MetricPill,
  Paragraph,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { pick, str, titleCase } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { LinkRow } from "@/components/map/featureCards/enrichments/LinkRow";

const BLM_MT_URL = "https://www.blm.gov/montana-dakotas";

const flagOn = (v: string | null): boolean => !!v && /^y(es)?$/i.test(v.trim());

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  // FWP service ships an unusual mix: DESCRIPTIO (no E) holds the SITE
  // NAME (surfaced via the card header), LAUNCH and FISHING are nullable Y flags.
  const launch = flagOn(str(get("LAUNCH")));
  const fishing = flagOn(str(get("FISHING", "Fishing")));
  const useType = str(get("USE_TYPE", "UseType"));
  const description = str(get("DESCRIPTION", "Description"));

  // Categorical hero — the user can't drive vehicles without knowing
  // whether this is a put-in vs a fishing spot vs a developed area.
  const calloutValue =
    launch && fishing
      ? "Boat launch + fishing"
      : launch
        ? "Boat launch"
        : fishing
          ? "Fishing access"
          : "Day-use site";

  return (
    <>
      {/* Hero already encodes launch + fishing, so those don't repeat as pills. */}
      <HeroBlock caption="Bureau of Land Management" value={calloutValue} />
      {useType && (
        <MetricGrid stack>
          <MetricPill label="Use type" value={useType} />
        </MetricGrid>
      )}
      {description && <Paragraph>{description}</Paragraph>}
      <TipBlock heading="BLM dispersed camping" intent="info">
        BLM land allows dispersed camping up to 14 days per site, then move 25 mi. Pack out trash
        and grey water; campfires only where permitted. The BLM Travel Management Plan governs
        motorized access — confirm at{" "}
        <a href={BLM_MT_URL} target="_blank" rel="noreferrer">
          blm.gov/montana-dakotas
        </a>
        .
      </TipBlock>
    </>
  );
};

const Enrichment = (_props: FeatureRendererProps): JSX.Element | null => (
  <LinkRow links={[{ label: "BLM Montana/Dakotas", href: BLM_MT_URL, icon: ExternalLink }]} />
);

registerFeature("blm-recreation-sites", {
  summary: (a) => titleCase(String(a.DESCRIPTIO ?? a.NAME ?? a.Name ?? "BLM recreation site")),
  subtitle: () => "Bureau of Land Management · Montana",
  Body,
  Enrichment,
  // Single-click opens the polished takeover view directly.
});
