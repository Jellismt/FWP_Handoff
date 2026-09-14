/**
 * @file RoadCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for MSL Transportation road segments. Class +
 *              surface + county. Low-priority overlay; useful for access route
 *              planning context.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import {
  HeroBlock,
  ListCard,
  MetricGrid,
  MetricPill,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const name = str(get("STREET_NAME", "NAME", "RoadName"));
  const cls = str(get("CLASS", "Class", "ROAD_CLASS"));
  const surface = str(get("SURFACE", "Surface"));
  const county = str(get("COUNTY", "County"));
  const speedLimit = num(get("SPEED_LIMIT", "SpeedLimit"));
  const owner = str(get("OWNER", "Owner"));

  return (
    <>
      <HeroBlock caption={cls ? `${cls} road` : "Road segment"} value={name ?? "Road"} />
      <MetricGrid>
        {surface && <MetricPill label="Surface" value={surface} />}
        {speedLimit !== null && <MetricPill label="Speed" value={`${speedLimit} mph`} />}
      </MetricGrid>
      <ListCard
        title="Road"
        rows={[
          ...(county ? [{ label: "County", value: county }] : []),
          ...(owner ? [{ label: "Owner", value: owner }] : []),
        ]}
      />
      <TipBlock intent="info">
        MSL Transportation reference data — useful for access route context. Legal travel on this
        segment depends on owner + signage; confirm vehicle rules with the managing agency before
        you go.
      </TipBlock>
    </>
  );
};

registerFeature("msl-roads", {
  summary: (a) => String(a.STREET_NAME ?? a.NAME ?? a.RoadName ?? "Road segment"),
  subtitle: () => "Montana State Library Transportation",
  Body,
});
