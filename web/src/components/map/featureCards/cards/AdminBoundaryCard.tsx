/**
 * @file AdminBoundaryCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for administrative-boundary overlays (FWP
 *              region, county, fisheries district). Low-priority context card.
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
import { formatCompact } from "@/utils/formatNumber";

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const name = str(get("NAME", "Name"));
  const boundaryType = str(get("TYPE", "BoundaryType"));
  const code = str(get("CODE", "Code"));
  const area = num(get("AREA_SQMI", "Area"));
  const headquarters = str(get("HEADQUARTERS", "Office"));

  return (
    <>
      <HeroBlock
        caption={boundaryType ?? "Administrative boundary"}
        value={name ?? code ?? "Boundary"}
      />
      <MetricGrid>
        {code && <MetricPill label="Code" value={code} />}
        {area !== null && <MetricPill label="Area" value={formatCompact(area, "sq mi")} />}
      </MetricGrid>
      {headquarters && (
        <ListCard title="Administration" rows={[{ label: "Office", value: headquarters }]} />
      )}
      <TipBlock intent="info">
        Reference overlay for FWP region, county, or fisheries district. Hunting and fishing
        regulations are defined by their own district layers — tap an HD or FD polygon for the
        actual rules.
      </TipBlock>
    </>
  );
};

registerFeature("admin-boundaries", {
  summary: (a) => String(a.NAME ?? a.Name ?? "Administrative boundary"),
  subtitle: () => "FWP / county / district boundary",
  Body,
});
