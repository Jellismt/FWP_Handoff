/**
 * @file DistrictSeasonWindows.tsx
 * @module engage-mt/hunt
 * @description Authoritative per-species season-window panel for a hunting
 *              district. Windows are never synthesized client-side.
 *
 *              Instead this reads the real per-species weapon windows from the
 *              FWP Regs Manager API via `useDistrictRegulations` (the same
 *              source the Regulations tab renders) and lists each weapon slot's
 *              humanized date range — no invention, no timezone-fragile epoch
 *              math. Mirrors `DistrictRegulationsPanel`'s loading Skeleton and
 *              error / not-in-extract → 2026 regulations fallbacks so the two
 *              sibling tabs read as one design language.
 *
 *              Accessibility: heading hierarchy matches the sibling Regulations
 *              tab (page h1 → panel h2 → per-species h3). Weapon windows are
 *              plain MetricPills, so screen readers get the label + range text
 *              with no reliance on color.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useDistrictRegulations } from "@/hooks/useDistrictRegulations";
import { collectSeasonWindows, type SpeciesKey } from "@/services/hunt/districtSeasonWindows";
import {
  MetricGrid,
  MetricPill,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { SkeletonListItem } from "@/components/shared/feedback/Skeleton";
import { FWP_REGS_URL } from "@/services/regs/useRegsIndex";

interface Props {
  district: string;
}

// Source link → FWP's canonical, always-current regulations page (not a bundled
// snapshot). Same URL on web + mobile.
const PDF_LINK = FWP_REGS_URL;

const SPECIES_ORDER: ReadonlyArray<{ key: SpeciesKey; title: string }> = [
  { key: "deer", title: "Deer" },
  { key: "elk", title: "Elk" },
  { key: "antelope", title: "Antelope" },
];

export const DistrictSeasonWindows = ({ district }: Props): JSX.Element => {
  const { loading, error, data } = useDistrictRegulations(district);

  if (loading) return <SkeletonListItem />;

  if (error) {
    return (
      <TipBlock heading="Couldn't load HD seasons" intent="warning">
        {error.message}. Refer to the 2026 regulations for this district —{" "}
        <a href={PDF_LINK} target="_blank" rel="noreferrer">
          view on fwp.mt.gov
        </a>
        .
      </TipBlock>
    );
  }

  if (!data) {
    return (
      <TipBlock heading="District not in current extract" intent="info">
        We don&rsquo;t yet carry structured seasons for HD {district}. Refer to the 2026 regulations
        —{" "}
        <a href={PDF_LINK} target="_blank" rel="noreferrer">
          view on fwp.mt.gov
        </a>
        .
      </TipBlock>
    );
  }

  const species = SPECIES_ORDER.map((s) => ({
    ...s,
    windows: collectSeasonWindows(data.byCategory[s.key]),
  })).filter((s) => s.windows.length > 0);

  return (
    <section aria-labelledby={`hd-seasons-${district}`}>
      <h2 id={`hd-seasons-${district}`} className="feature-section-heading">
        HD {data.hd} — {data.name} · Region {data.region} · Season windows
      </h2>

      {species.length === 0 ? (
        <TipBlock heading="No structured season windows" intent="info">
          The regulations extract for HD {district} doesn&rsquo;t break out per-species weapon
          windows. Open the Regulations tab for the per-license rows, or the 2026 regulations —{" "}
          <a href={PDF_LINK} target="_blank" rel="noreferrer">
            view on fwp.mt.gov
          </a>
          .
        </TipBlock>
      ) : (
        species.map((s) => (
          <div key={s.key}>
            <h3 className="feature-section-heading">{s.title}</h3>
            <MetricGrid>
              {s.windows.map((w) => (
                <MetricPill key={w.label} label={w.label} value={w.value} />
              ))}
            </MetricGrid>
          </div>
        ))
      )}
    </section>
  );
};

export default DistrictSeasonWindows;
