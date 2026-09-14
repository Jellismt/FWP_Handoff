/**
 * @file HuntingDistrictCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for hunting districts. Routes "Open detail" to the
 *              already-built /hunt/district/:district page.
 *
 *              Registered for the 6 per-species variants
 *              (general/big-game, antelope, sheep, moose, goat, upland-bird).
 *              The renderer reads the layer id off the registry id (FWP's
 *              admbnd/huntingDistricts service uses the same DISTRICT
 *              attribute across species) and surfaces the species in the
 *              card subtitle so the user knows whether they're reading the
 *              deer-elk district or the antelope district.
 *
 *              Adopts the per-district deep-links (ELKWEBPAGE /
 *              DEERWEBPAGE / WEBPAGE + MAPLINK) into a LinkRow.
 *
 *              The weapon-restriction note now upgrades to FWP's
 *              verbatim area name + comment (public Big Game Restricted Areas
 *              layer) when the tap lands inside a restricted-area polygon.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-14
 * @version 1.4.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect } from "react";
import { BookOpen, FileText } from "lucide-react";
import {
  HeroBlock,
  MetricGrid,
  MetricPill,
  Paragraph,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { formatCompact } from "@/utils/formatNumber";
import { LinkRow } from "@/components/map/featureCards/enrichments/LinkRow";
import { useFetchJson } from "@/hooks/useFetchJson";
import { useWeaponRestrictionArea } from "@/hooks/useWeaponRestrictionArea";
import { usePortionAtPoint } from "@/hooks/usePortionAtPoint";
import { useTappedPortionStore } from "@/store/map/tappedPortionStore";

/** Minimal shape read from the bundled district-facts for the weapon-restriction
 *  flag (the full row lives in DistrictFactsRow / the detail page). */
interface DistrictWeaponFact {
  district: string;
  weapon_restriction?: boolean;
}
const DISTRICT_FACTS_URL = "/data/hunting-district-facts.json";

const SPECIES_LABEL: Record<string, string> = {
  "hunting-districts": "Deer + Elk · General",
  "hunting-districts-antelope": "Antelope",
  "hunting-districts-sheep": "Bighorn Sheep",
  "hunting-districts-moose": "Moose",
  "hunting-districts-goat": "Mountain Goat",
  "hunting-districts-upland-bird": "Upland Bird",
};

const Body = ({ attrs, tapPoint }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const district = str(get("DISTRICT", "District", "district"));
  const region = num(get("REG", "REGION", "Region", "region"));
  const acres = num(get("AREA_AC", "ACRES", "Acres"));
  const regYear = str(get("REGYEAR", "Reg Year"));
  const note = str(get("DESCRIPTION", "Note", "NOTES"));

  // Per addendum Part 1 Layer 1 — big-game districts carry separate
  // ELKWEBPAGE + DEERWEBPAGE; antelope/sheep/moose/goat/upland-bird
  // collapse to a single WEBPAGE. MAPLINK is the printable PDF.
  const elkWeb = str(get("ELKWEBPAGE", "Elk Web Page"));
  const deerWeb = str(get("DEERWEBPAGE", "Deer Web Page"));
  const genericWeb = str(get("WEBPAGE", "Web Page"));
  const pdfMap = str(get("MAPLINK", "PDF Map", "PDFMAP"));

  // Surface the district's weapon-restriction flag (e.g. HD 388) from
  // the bundled facts so a hunter sees it on tap, not only on the detail page.
  const factsQ = useFetchJson<DistrictWeaponFact[]>(DISTRICT_FACTS_URL);
  const weaponRestricted =
    factsQ.data?.find((f) => f.district === district)?.weapon_restriction === true;

  // When the user taps INSIDE a restricted-area polygon, surface FWP's verbatim
  // area name + comment (from the public Big Game Restricted Areas layer) rather
  // than the generic district-level note. Falls back to the boilerplate when the
  // tap is elsewhere in the district or no tap point is available.
  const restriction = useWeaponRestrictionArea(tapPoint);

  // When the tap lands inside a district PORTION (e.g. "…South of Rock Creek"),
  // resolve it and stash it so the district regs panel can EMPHASIZE that portion's
  // rules (without hiding district-wide rules). Only portions in THIS district count.
  const portionQ = usePortionAtPoint(tapPoint);
  const tappedPortions = portionQ.portions.filter((p) => p.district === district);
  const tappedKey = tappedPortions.map((p) => p.shapecode).join(",");
  useEffect(() => {
    if (!district || !tappedKey) return;
    useTappedPortionStore.getState().set({
      district,
      shapecodes: tappedKey.split(","),
      portionNames: tappedPortions.map((p) => p.portionName),
    });
    // tappedKey is the stable derived dep for the tappedPortions array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district, tappedKey]);

  return (
    <>
      {acres !== null ? (
        <HeroBlock caption="District area" value={formatCompact(acres, "ac")} domain="wildlife" />
      ) : (
        <HeroBlock
          caption={region !== null ? `FWP Region ${region}` : "Hunting district"}
          value={district ? `District ${district}` : "District"}
          domain="wildlife"
        />
      )}
      <MetricGrid>
        {region !== null && <MetricPill label="Region" value={`${region}`} />}
        {regYear && <MetricPill label="Reg year" value={regYear} />}
      </MetricGrid>
      {restriction.area ? (
        // Tap landed inside an actual restricted-area polygon — show FWP's
        // published area name + verbatim comment.
        <TipBlock heading={restriction.area.portionName} intent="warning">
          {restriction.area.comments
            ? restriction.area.comments
            : "This spot falls inside a designated FWP big-game restricted area. Check the current regulations for which weapons are legal here."}
        </TipBlock>
      ) : (
        weaponRestricted &&
        !restriction.loading && (
          <TipBlock heading="Weapon-restriction area" intent="warning">
            Part of District {district} is a designated weapon-restriction area (e.g. archery-only
            or shotgun / muzzleloader-only near developed land). Check the current regulations for
            the exact boundary and which weapons are legal where.
          </TipBlock>
        )
      )}
      {tappedPortions.length > 0 && (
        <TipBlock
          heading={
            tappedPortions.length === 1
              ? tappedPortions[0]!.portionName
              : "Sub-district portions here"
          }
          intent="info"
        >
          {tappedPortions.length === 1
            ? "You tapped inside this portion of the district — some rules apply only here. Open detail to see the highlighted rules."
            : `You tapped inside: ${tappedPortions.map((p) => p.portionName).join("; ")}. Some rules apply only to these areas.`}
        </TipBlock>
      )}
      {note ? (
        <Paragraph>{note}</Paragraph>
      ) : (
        <TipBlock intent="info">
          Open detail to see season windows, regulations, and the counties this district spans.
        </TipBlock>
      )}
      <LinkRow
        links={[
          elkWeb ? { label: "Elk regulations", href: elkWeb, icon: BookOpen } : null,
          deerWeb ? { label: "Deer regulations", href: deerWeb, icon: BookOpen } : null,
          genericWeb && !elkWeb && !deerWeb
            ? { label: "Species regulations", href: genericWeb, icon: BookOpen }
            : null,
          pdfMap ? { label: "PDF map", href: pdfMap, icon: FileText } : null,
        ]}
      />
    </>
  );
};

const summary = (a: Record<string, unknown>): string => {
  const d = a.DISTRICT ?? a.District ?? a.district;
  return d ? `District ${d}` : "Hunting District";
};
const detailRoute = (a: Record<string, unknown>): string | null => {
  const d = a.DISTRICT ?? a.District ?? a.district;
  if (typeof d === "string" && d.length > 0) return `/hunt/district/${d}`;
  if (typeof d === "number") return `/hunt/district/${d}`;
  return null;
};

for (const layerId of Object.keys(SPECIES_LABEL)) {
  registerFeature(layerId, {
    summary,
    subtitle: () => `${SPECIES_LABEL[layerId]} · Season + regulation boundary`,
    Body,
    detailRoute,
    // A district polygon exists to answer "what are the rules here?" — go
    // straight to its report rather than making the user tap a card first.
    tapRoute: detailRoute,
  });
}

// District PORTIONS (sub-district polygons, e.g. "…South of Rock Creek") carry
// the parent district code, so a tap opens that district's report too.
const PORTION_LAYER_IDS = [
  "district-portions-elk",
  "district-portions-mule-deer",
  "district-portions-white-tailed-deer",
  "district-portions-antelope",
] as const;

for (const layerId of PORTION_LAYER_IDS) {
  registerFeature(layerId, {
    summary,
    subtitle: () => "District portion · Season + regulation boundary",
    Body,
    detailRoute,
    tapRoute: detailRoute,
  });
}
