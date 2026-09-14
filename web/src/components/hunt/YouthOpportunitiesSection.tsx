/**
 * @file YouthOpportunitiesSection.tsx
 * @module engage-mt/hunt
 * @description District enrichment: youth / PTHFV special deer & elk opportunities valid in
 *              a hunting district (printed p.124), from the regs v2 API. Renders nothing
 *              when there are none AND nothing on error — enrichment must never degrade the
 *              core regulations panel.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useYouthOpportunities } from "@/hooks/useDistrictEnrichment";
import { ListCard } from "@/components/map/featureCards/core/cardPrimitives";

interface Props {
  hd: string;
}

const CODE_LABEL: Record<string, string> = {
  YOUTH_ONLY: "Youth only",
  PTHFV: "PTHFV holders",
};

const eligibility = (codes: string): string =>
  codes
    .split(",")
    .map((c) => CODE_LABEL[c.trim()] ?? c.trim())
    .filter(Boolean)
    .join(" · ");

export const YouthOpportunitiesSection = ({ hd }: Props): JSX.Element | null => {
  const rows = useYouthOpportunities(hd);
  if (rows.length === 0) return null;

  return (
    <section aria-label={`Youth and PTHFV opportunities in HD ${hd}`}>
      <h3 className="feature-section-heading">Youth &amp; PTHFV opportunities here</h3>
      {rows.map((r, i) => {
        const meta = [
          { label: "License", value: r.license },
          { label: "Opportunity", value: r.opportunity },
          { label: "Eligibility", value: eligibility(r.restriction_codes) },
        ];
        if (r.validity_note) meta.push({ label: "Notes", value: r.validity_note });
        return <ListCard key={`youth-${i}`} title={r.opportunity} rows={meta} />;
      })}
    </section>
  );
};

export default YouthOpportunitiesSection;
