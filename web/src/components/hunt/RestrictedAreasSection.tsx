/**
 * @file RestrictedAreasSection.tsx
 * @module engage-mt/hunt
 * @description District enrichment: the restricted areas (WMAs, weapons-restriction areas,
 *              closures) linked to a hunting district, with their legal descriptions, from
 *              the regs v2 API. Renders nothing when there are none AND nothing on error —
 *              enrichment must never degrade the core regulations panel.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useRestrictedAreas } from "@/hooks/useDistrictEnrichment";
import { areaTypeLabel } from "@/services/regsApi/restrictedAreas";
import { ListCard } from "@/components/map/featureCards/core/cardPrimitives";

interface Props {
  hd: string;
}

export const RestrictedAreasSection = ({ hd }: Props): JSX.Element | null => {
  const areas = useRestrictedAreas(hd);
  if (areas.length === 0) return null;

  return (
    <section aria-label={`Restricted areas in HD ${hd}`}>
      <h3 className="feature-section-heading">Restricted areas here</h3>
      {areas.map((a, i) => {
        const rows = [{ label: "Type", value: areaTypeLabel(a.area_type) }];
        if (a.legal_desc) rows.push({ label: "Description", value: a.legal_desc });
        return <ListCard key={`ra-${i}`} title={a.area_name} rows={rows} />;
      })}
    </section>
  );
};

export default RestrictedAreasSection;
