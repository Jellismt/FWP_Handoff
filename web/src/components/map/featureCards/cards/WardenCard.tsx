/**
 * @file WardenCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for FWP game-warden coverage areas
 *              (ADMBND_RESPAREA_WARDEN). Answers "who is the warden for this
 *              area and how do I reach them?" — leads with the warden's name +
 *              title, then badge / region / coverage area, call + email actions,
 *              and a one-tap opener for the TipMont warden contacts. The service
 *              publishes real name + badge + phone + email, so — unlike the
 *              biologist card — no regional-office redirect is needed.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-08
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ShieldAlert } from "lucide-react";
import {
  MetricCallout,
  MetricGrid,
  MetricPill,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { PillButton } from "@/components/shared/forms/PillButton";
import { openTipMont } from "@/store/account/tipMontStore";

/** DISPLAYNAME is a surname; CONTACT is sometimes a fuller name. */
const wardenName = (get: ReturnType<typeof pick>): string | null =>
  str(get("CONTACT", "Contact")) ?? str(get("DISPLAYNAME", "DisplayName"));

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const name = wardenName(get);
  const title = str(get("TITLE", "Title")) ?? "Warden";
  const region = str(get("REGION", "Region"));
  const areaName = str(get("AREANAME", "AreaName", "AREA_NAME"));

  return (
    <>
      <MetricCallout
        title={areaName ? `${areaName} warden district` : "FWP game warden"}
        value={name ?? "Game warden"}
        sub={region ? `${title} · Region ${region}` : title}
        intent="default"
      />
      {/* Badge number + region were noise — the callout above already names
          the warden, their title and their region. */}
      <MetricGrid stack>
        {areaName && <MetricPill label="Coverage area" value={areaName} />}
      </MetricGrid>
      <TipBlock heading="Reporting a violation" intent="info">
        Call <strong>911</strong> for a violation in progress. Otherwise report wildlife crime any
        time — anonymously — to TipMont by phone, or call the warden who covers this area.
      </TipBlock>
    </>
  );
};

// The Call / Email / Report-to-TipMont links duplicated the single
// "Warden contacts" action below, which opens the same TipMont surface.
const Enrichment = (): JSX.Element => {
  return (
    <>
      <PillButton
        variant="primary"
        iconStart={ShieldAlert}
        ariaLabel="Open the TipMont warden contacts"
        onClick={() => openTipMont()}
      >
        Warden contacts
      </PillButton>
    </>
  );
};

/**
 * Wildlife-biologist areas had no renderer, so a tap fell through to the
 * generic attribute dump — raw field names ("AREANAME: Region 2", "REGION: 2")
 * with the region stated twice. The area name IS the region label.
 */
registerFeature("wildlife-biologist-coverage", {
  hideMeta: true,
  summary: (a) => {
    const area = str(a.AREANAME ?? a.AreaName ?? a.AREA_NAME);
    const contact = str(a.CONTACT ?? a.DISPLAYNAME ?? a.BIOLOGIST);
    if (contact && area) return `${contact} · ${area}`;
    return contact ?? area ?? "Wildlife biologist area";
  },
  Body: ({ attrs }: FeatureRendererProps): JSX.Element => {
    const get = pick(attrs);
    const area = str(get("AREANAME", "AreaName", "AREA_NAME"));
    const contact = str(get("CONTACT", "DISPLAYNAME", "BIOLOGIST"));
    return (
      <>
        <MetricCallout
          title="Wildlife biologist area"
          value={contact ?? area ?? "FWP wildlife biologist"}
          intent="default"
        />
        <MetricGrid stack>{area && <MetricPill label="Region" value={area} />}</MetricGrid>
      </>
    );
  },
});

registerFeature("warden-districts", {
  summary: (a) => {
    const c = str(a.CONTACT ?? a.DISPLAYNAME);
    const an = str(a.AREANAME);
    if (c && an) return `Warden ${c} · ${an}`;
    return c ? `Warden ${c}` : (an ?? "FWP warden district");
  },
  subtitle: (a) => {
    const r = str(a.REGION);
    return r ? `Region ${r} · FWP game warden` : "FWP Enforcement · Game warden";
  },
  Body,
  Enrichment,
});
