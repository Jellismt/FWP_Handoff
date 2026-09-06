/**
 * @file NhdStreamCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for the major-hydro features — named rivers
 *              (lines) and lakes (polygons) from the Montana State Library's
 *              1:100k Major Lakes & Streams dataset, dissolved by name at build
 *              time so one tap resolves the whole river. Leads with the feature
 *              name; surfaces a length (rivers) or area (lakes) metric when the
 *              dataset carries one. One renderer serves both the `major-rivers`
 *              line layer and the `major-lakes` polygon layer.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-16
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import {
  DomainPill,
  HeroBlock,
  MetricGrid,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const name = str(get("name", "NAME", "Name"));
  const miles = num(get("miles", "MILES"));
  const acres = num(get("acres", "ACRES"));
  const isLake = acres !== null;

  return (
    <>
      <HeroBlock
        caption={isLake ? "Lake / reservoir" : "River"}
        value={name ?? (isLake ? "Waterbody" : "River")}
        domain="flow"
      />
      {(miles !== null || acres !== null) && (
        <MetricGrid stack>
          {miles !== null && (
            <DomainPill label="Length" value={`${miles.toFixed(1)} mi`} domain="flow" />
          )}
          {acres !== null && (
            <DomainPill
              label="Area"
              value={`${Math.round(acres).toLocaleString()} acres`}
              domain="flow"
            />
          )}
        </MetricGrid>
      )}
    </>
  );
};

const spec = {
  // The river/lake name is the title and the hero — a provenance strip under
  // it added nothing.
  hideMeta: true,
  summary: (a: Record<string, unknown>): string => String(a.name ?? a.NAME ?? a.Name ?? "Waterway"),
  Body,
};

registerFeature("major-rivers", spec);
registerFeature("major-lakes", spec);
