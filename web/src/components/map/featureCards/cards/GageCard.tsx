/**
 * @file GageCard.tsx
 * @module engage-mt/map/featureCards
 * @description Feature card for the two live stream-gage sources: USGS NWIS
 *              (`usgs-gages`) and Montana DNRC StAGE (`dnrc-stage-gages`).
 *              Each card shows two numbers — current flow and current water
 *              temperature — fetched when the card opens.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-09-05
 * @version 5.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { HeroBlock, HeroPair, TipBlock } from "@/components/map/featureCards/core/cardPrimitives";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import { pick, str } from "@/components/map/featureCards/core/types";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { useUsgsLatest } from "@/hooks/useUsgsLatest";
import { useDnrcStage } from "@/hooks/useDnrcStage";
import { detectSource } from "@/services/hydrology/gageSourceDispatch";
import { cToF } from "@/utils/units";

const fmtCfs = (cfs: number): string => Math.round(cfs).toLocaleString();

const Readings = ({
  cfs,
  tempF,
  stageFt,
}: {
  cfs: number | null;
  tempF: number | null;
  stageFt?: number | null;
}): JSX.Element => (
  <HeroPair>
    {cfs === null && stageFt != null ? (
      <HeroBlock caption="Gauge height" value={stageFt.toFixed(2)} unit="ft" />
    ) : (
      <HeroBlock caption="Current flow" value={cfs !== null ? fmtCfs(cfs) : "—"} unit="cfs" />
    )}
    <HeroBlock
      caption="Water temperature"
      value={tempF !== null ? tempF.toFixed(1) : "—"}
      unit="°F"
    />
  </HeroPair>
);

const UsgsBlock = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const siteNo = str(pick(attrs)("site_no")) ?? "";
  const live = useUsgsLatest(siteNo ? [siteNo] : [], ["discharge_cfs", "water_temperature_c"]);
  const cfs = live.observations.find((o) => o.param === "discharge_cfs")?.value ?? null;
  const tempC = live.observations.find((o) => o.param === "water_temperature_c")?.value ?? null;
  const tempF = tempC !== null ? cToF(tempC) : null;

  if (live.loading) {
    return (
      <TipBlock heading="Fetching live USGS values…" intent="info">
        Pulling discharge + temperature from USGS NWIS for site <strong>{siteNo}</strong>.
      </TipBlock>
    );
  }
  if (live.error || (cfs === null && tempF === null)) {
    return (
      <TipBlock heading="No live reading just now" intent="info">
        USGS NWIS didn&rsquo;t return a current reading for site <strong>{siteNo}</strong>. The
        station is still active — NWIS occasionally drops a polling cycle.
      </TipBlock>
    );
  }
  return <Readings cfs={cfs} tempF={tempF} />;
};

const DnrcBlock = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const locationCode = str(pick(attrs)("LocationCode")) ?? "";
  const { loading, error, data } = useDnrcStage(locationCode || null);
  const cfs = data?.cfs ?? null;
  const tempF = data?.tempF ?? null;
  const stageFt = data?.stageFt ?? null;

  if (loading) {
    return (
      <TipBlock heading="Fetching live DNRC values…" intent="info">
        Pulling discharge + temperature from Montana DNRC StAGE for station{" "}
        <strong>{locationCode || "—"}</strong>.
      </TipBlock>
    );
  }
  if (cfs === null && tempF === null && stageFt === null) {
    return (
      <TipBlock heading="No live reading just now" intent="info">
        {error
          ? "Engage MT couldn't reach DNRC StAGE for this station. Try again in a moment."
          : "DNRC StAGE didn't return a current reading for this station this cycle — it may be seasonally offline or between polls."}
      </TipBlock>
    );
  }
  return <Readings cfs={cfs} tempF={tempF} stageFt={stageFt} />;
};

const GageBody = (props: FeatureRendererProps): JSX.Element =>
  detectSource(props.attrs) === "dnrc" ? <DnrcBlock {...props} /> : <UsgsBlock {...props} />;

const gageSummary = (a: Record<string, unknown>): string => {
  const name = str(a.name) ?? str(a.LocationName);
  if (name) return name;
  const river = str(a.river);
  const siteNo = str(a.site_no) ?? str(a.LocationCode);
  if (river && siteNo) return `${river} · ${siteNo}`;
  return siteNo ?? river ?? "Gage";
};

registerFeature("usgs-gages", { hideMeta: true, summary: gageSummary, Body: GageBody });
registerFeature("dnrc-stage-gages", { hideMeta: true, summary: gageSummary, Body: GageBody });
