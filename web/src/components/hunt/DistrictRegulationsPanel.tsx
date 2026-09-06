/**
 * @file DistrictRegulationsPanel.tsx
 * @module engage-mt/hunt
 * @description Renders the FULL set of per-license-type rows for a
 *              hunting district as extracted from the 2026 DEA PDF. Replaces
 *              the SeasonDashboard's "derived from elk-general dates"
 *              approach with the actual regulation table.
 *
 *              Sections:
 *                • District notes (WMA closures, CWD sampling, BNSF, etc.)
 *                • DEER table — one row per (license, opportunity)
 *                • ELK table  — same
 *                • ANTELOPE   — only when the district carries antelope regs
 *                • Restricted areas + youth opportunities enrichment
 *
 *              When the regs lookup misses (the user is viewing an HD that
 *              wasn't in the extracted batch — typical for a few of the
 *              ~170 HDs that parse-fail), the panel surfaces an explicit
 *              "Refer to the 2026 DEA PDF for this district" notice with a
 *              deep link, so the user is never silently shown nothing.
 *
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-16
 * @version 1.4.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect } from "react";
import { useDistrictRegulations, type DistrictRegulationRow } from "@/hooks/useDistrictRegulations";
import { useTappedPortionStore } from "@/store/map/tappedPortionStore";
import { ListCard, TipBlock } from "@/components/map/featureCards/core/cardPrimitives";
import { FreshnessChip } from "@/components/shared/widgets/FreshnessChip";
import { SkeletonListItem } from "@/components/shared/feedback/Skeleton";
import { FWP_REGS_URL } from "@/services/regs/useRegsIndex";
import { CorrectionsBanner } from "./CorrectionsBanner";
import { RestrictedAreasSection } from "./RestrictedAreasSection";
import { YouthOpportunitiesSection } from "./YouthOpportunitiesSection";

interface Props {
  district: string;
}

// Source link → FWP's canonical, always-current regulations page (not a bundled
// snapshot). Same URL on web + mobile.
const PDF_LINK = FWP_REGS_URL;

const SpeciesSection = ({
  title,
  rows,
  emphasized,
}: {
  title: string;
  rows: readonly DistrictRegulationRow[];
  /** SHAPECODEs the hunter tapped inside — matching rows are marked "Where you tapped". */
  emphasized: ReadonlySet<string>;
}): JSX.Element | null => {
  if (rows.length === 0) return null;
  return (
    <>
      <h3 className="feature-section-heading">{title}</h3>
      {rows.map((r, i) => {
        const isTapped = !!r.portionCode && emphasized.has(r.portionCode);
        const meta: { label: string; value: string }[] = [];
        // Sub-district scope leads: this rule is valid only in this portion of the HD.
        if (r.portionName) meta.push({ label: "Applies in", value: r.portionName });
        if (r.license) meta.push({ label: "License", value: r.license });
        if (r.opportunity) meta.push({ label: "Opportunity", value: r.opportunity });
        if (r.applyByDate) meta.push({ label: "Apply by", value: r.applyByDate });
        if (r.quota != null) meta.push({ label: "Quota", value: String(r.quota) });
        if (r.quotaRange) meta.push({ label: "Quota range", value: r.quotaRange });
        if (r.earlySeasonDates) meta.push({ label: "Early season", value: r.earlySeasonDates });
        if (r.archeryDates) meta.push({ label: "Archery only", value: r.archeryDates });
        if (r.generalDates) meta.push({ label: "General season", value: r.generalDates });
        if (r.heritageMuzzleloaderDates)
          meta.push({ label: "Heritage / muzzleloader", value: r.heritageMuzzleloaderDates });
        if (r.lateSeasonDates) meta.push({ label: "Late season", value: r.lateSeasonDates });
        if (r.seasonDates) meta.push({ label: "Season dates", value: r.seasonDates });
        if (r.opportunitySpecific)
          meta.push({ label: "Restrictions / notes", value: r.opportunitySpecific });
        const baseHeading = `${r.opportunity ?? r.license ?? "Row"}${
          r.license && r.opportunity ? ` — ${r.license}` : ""
        }`;
        // Emphasize (never hide) a rule scoped to the portion the hunter tapped inside.
        const heading = isTapped ? `◆ Where you tapped — ${baseHeading}` : baseHeading;
        return <ListCard key={`${title}-${i}`} title={heading} rows={meta} />;
      })}
    </>
  );
};

const EMPTY_SET: ReadonlySet<string> = new Set();

export const DistrictRegulationsPanel = ({ district }: Props): JSX.Element => {
  const { loading, error, data } = useDistrictRegulations(district);
  // If the hunter tapped inside a portion of THIS district, emphasize its rules.
  const tapped = useTappedPortionStore((s) => s.tapped);
  const clearTapped = useTappedPortionStore((s) => s.clear);
  const emphasized: ReadonlySet<string> =
    tapped && tapped.district === district ? new Set(tapped.shapecodes) : EMPTY_SET;
  // Clear the tap emphasis on leave so it never bleeds onto a different district.
  useEffect(() => () => clearTapped(), [district, clearTapped]);

  if (loading) return <SkeletonListItem />;

  if (error) {
    return (
      <TipBlock heading="Couldn't load HD regulations" intent="warning">
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
        We don&rsquo;t yet carry structured regulations for HD {district}. Refer to the 2026
        regulations —{" "}
        <a href={PDF_LINK} target="_blank" rel="noreferrer">
          view on fwp.mt.gov
        </a>
        .
      </TipBlock>
    );
  }

  const freshness = data.freshness;
  return (
    <section aria-label={`HD ${data.hd} regulations`}>
      <FreshnessChip
        freshness="versioned"
        source={freshness.sourceLabel}
        effectiveDate={freshness.effectiveDate ?? undefined}
        cached={freshness.tier === "cached"}
        fieldCopy={freshness.tier === "field-copy"}
        bundled={freshness.tier === "bundled"}
        stale={freshness.stale}
        lastUpdate={freshness.tier === "live" ? undefined : freshness.fetchedAt}
      />

      {freshness.stale && (
        <TipBlock heading="This copy may be out of date" intent="warning">
          These regulations were last refreshed {freshness.fetchedAt.slice(0, 10)}
          {freshness.validUntil ? ` and were valid through ${freshness.validUntil}` : ""}. Reconnect
          to refresh, or confirm on{" "}
          <a href={PDF_LINK} target="_blank" rel="noreferrer">
            fwp.mt.gov
          </a>{" "}
          before you hunt.
        </TipBlock>
      )}

      <CorrectionsBanner hd={data.hd} servedVersion={freshness.version} />

      {data.notes.length > 0 && (
        <TipBlock heading="District notes" intent="warning">
          <ul className="fwp-bullet-list">
            {data.notes.map((n, i) => (
              <li key={`note-${i}`}>{n}</li>
            ))}
          </ul>
        </TipBlock>
      )}

      <SpeciesSection title="Deer" rows={data.byCategory.deer} emphasized={emphasized} />
      <SpeciesSection title="Elk" rows={data.byCategory.elk} emphasized={emphasized} />
      <SpeciesSection title="Antelope" rows={data.byCategory.antelope} emphasized={emphasized} />

      <RestrictedAreasSection hd={data.hd} />
      <YouthOpportunitiesSection hd={data.hd} />
    </section>
  );
};

export default DistrictRegulationsPanel;
