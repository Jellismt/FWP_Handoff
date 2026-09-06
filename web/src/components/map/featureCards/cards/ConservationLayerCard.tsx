/**
 * @file ConservationLayerCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for generic conservation overlays beyond the
 *              dedicated easements layer (e.g. Habitat Montana Program units,
 *              fish habitat improvement projects).
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import {
  DomainPill,
  HeroBlock,
  ListCard,
  MetricGrid,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { formatCompact } from "@/utils/formatNumber";

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const program = str(get("PROGRAM", "Program"));
  const acres = num(get("ACRES", "Acres"));
  const holder = str(get("HOLDER", "Holder", "Organization"));
  const restrictions = str(get("RESTRICTIONS", "Restrictions"));
  const purpose = str(get("PURPOSE", "Purpose"));

  return (
    <>
      {acres !== null ? (
        <HeroBlock
          caption={program ?? "Conservation overlay"}
          value={formatCompact(acres)}
          unit="ac"
          domain="park"
        />
      ) : (
        <HeroBlock
          caption="Conservation overlay"
          value={program ?? "Protected land"}
          domain="park"
        />
      )}
      <MetricGrid>
        {program && <DomainPill label="Program" value={program} domain="park" />}
      </MetricGrid>
      <ListCard
        title="Conservation"
        rows={[
          ...(holder ? [{ label: "Holder", value: holder }] : []),
          ...(purpose ? [{ label: "Purpose", value: purpose }] : []),
        ]}
      />
      {restrictions ? (
        <TipBlock heading="Restrictions" intent="warning">
          {restrictions}
        </TipBlock>
      ) : (
        <TipBlock heading="Conservation overlay" intent="info">
          Conservation parcels carry use restrictions set by the holding organization. Confirm
          allowed activities with the holder before access.
        </TipBlock>
      )}
    </>
  );
};

registerFeature("conservation-layers", {
  summary: (a) => String(a.NAME ?? a.PROGRAM ?? "Conservation unit"),
  subtitle: () => "Conservation overlay",
  Body,
});
