/**
 * @file TrailCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for the six authoritative trail layers.
 *              Same card used by:
 *                - the embedded Trail Explorer map (tap a polyline)
 *                - the global LayerPanel-driven map (tap a polyline)
 *                - the Trail Explorer list (Expand → takeover)
 *              Composes primitives only per docs/rules/feature-cards.md.
 *
 *              Hero: miles (HeroBlock, elev domain) — with a status
 *              MetricCallout when the trail is closed or seasonal.
 *              Pills: difficulty / surface / ADA / source.
 *              ChipRow: allowed uses.
 *              TipBlock: closure window when present.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Accessibility, ExternalLink, Footprints, Route } from "lucide-react";
import {
  ChipRow,
  HeroBlock,
  MetricCallout,
  MetricGrid,
  MetricPill,
  Paragraph,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";

const SOURCE_LAYER_IDS: readonly string[] = [
  "trails-usfs-nfs",
  "trails-nps-glacier",
  "trails-nps-yellowstone",
  "trails-lewis-clark",
  "trails-missoula-county",
  "trails-bozeman-gvlt",
];

/**
 * Per-layer source label used by the popup subtitle on global-map taps
 * (where attrs are the raw upstream service fields and the normalized
 * `managerLabel` isn't present). Keeps the user oriented to which agency
 * owns the trail they tapped, even when the underlying ADMIN_ORG code
 * means nothing to a non-Forest-Service reader.
 */
/* The owning agency in plain words — this is the whole meta line under the
   trail name now, so it reads "Forest Service" rather than a
   service + dataset + freshness provenance chain. */
const SOURCE_LABEL_BY_LAYER_ID: Record<string, string> = {
  "trails-usfs-nfs": "Forest Service",
  "trails-nps-glacier": "National Park Service",
  "trails-nps-yellowstone": "National Park Service",
  "trails-lewis-clark": "Lewis & Clark County",
  "trails-missoula-county": "Missoula County",
  "trails-bozeman-gvlt": "City of Bozeman",
};

interface NormalizedSurfaceUI {
  difficulty: string | null;
  difficultyIntent: "default" | "success" | "warning" | "danger";
  surface: string | null;
  ada: boolean | null;
  uses: readonly string[];
  status: "open" | "seasonal" | "closed";
  closureBegin: string | null;
  closureEnd: string | null;
  closureReason: string | null;
  miles: number | null;
  name: string;
  managerLabel: string;
  note: string | null;
  externalUrl: string | null;
  sourceLabel: string;
}

const DIFFICULTY_INTENT: Record<string, "success" | "default" | "warning"> = {
  easy: "success",
  moderate: "default",
  strenuous: "warning",
};

/**
 * Some upstream trail services ship the managing agency as a numeric code
 * rather than a name. Only surface a manager label that reads as a real
 * name (contains at least one letter); drop bare codes/numbers.
 */
const cleanManager = (raw: string | null): string => (raw && /[a-z]/i.test(raw) ? raw : "");

/**
 * A tap on a trail FeatureLayer surfaces the upstream service fields
 * (TRAIL_NAME, SEGMENT_LENGTH, etc.); the older normalized shape (`name`,
 * `miles`, …) is still read defensively so the card is robust to either.
 */
const readAttrs = (attrs: Record<string, unknown>): NormalizedSurfaceUI => {
  const g = pick(attrs);
  // Prefer the normalized shape if present (Trail Explorer path).
  const normalizedName = str(attrs.name);
  if (normalizedName !== null) {
    const usesRaw = Array.isArray(attrs.uses) ? (attrs.uses as readonly string[]) : [];
    const difficulty = str(attrs.difficulty);
    const status = (str(attrs.status) as "open" | "seasonal" | "closed" | null) ?? "open";
    const closure =
      (attrs.closure as { begin?: string; end?: string; reason?: string } | undefined) ?? undefined;
    return {
      difficulty,
      difficultyIntent: difficulty ? (DIFFICULTY_INTENT[difficulty] ?? "default") : "default",
      surface: str(attrs.surface),
      ada: typeof attrs.adaAccessible === "boolean" ? (attrs.adaAccessible as boolean) : null,
      uses: usesRaw,
      status,
      closureBegin: closure?.begin ?? null,
      closureEnd: closure?.end ?? null,
      closureReason: closure?.reason ?? null,
      miles: num(attrs.miles),
      name: normalizedName,
      managerLabel: cleanManager(str(attrs.managerLabel)),
      note: str(attrs.note),
      externalUrl: str(attrs.externalUrl),
      sourceLabel: str((attrs.attribution as { source?: string } | undefined)?.source) ?? "",
    };
  }
  // Fallback to raw upstream attribute names — match a useful subset across
  // all six sources so the global-map tap still gets a meaningful card.
  const name = str(g("TRAIL_NAME", "NAME", "trail_name", "TRLNAME", "TrailSyst")) ?? "Trail";
  const miles = num(
    g("SEGMENT_LENGTH", "GIS_MILES", "Miles", "trail_miles", "Length_Mi", "LENGTH_MILES"),
  );
  // Allowed uses from the USFS per-use "managed" season fields — a non-empty
  // value means the use is open on this trail. Non-USFS sources ship no such
  // fields, so their chip row simply hides.
  const USE_FIELDS: readonly (readonly [string, string])[] = [
    ["hiker_pedestrian_managed", "hike"],
    ["bicycle_managed", "bike"],
    ["pack_saddle_managed", "horse"],
    ["motorcycle_managed", "motorcycle"],
    ["atv_managed", "atv"],
    ["snowmobile_managed", "snowmobile"],
    ["snowshoe_managed", "snowshoe"],
    ["xcountry_ski_managed", "ski"],
  ];
  const uses = USE_FIELDS.filter(([field]) => {
    const v = str(g(field, field.toUpperCase()));
    return v !== null && v.trim().length > 0;
  }).map(([, use]) => use);

  return {
    difficulty: null,
    difficultyIntent: "default",
    surface: str(g("TRAIL_SURFACE", "surface_type", "Surface", "SurfaceType", "MATERIAL")),
    ada: null,
    uses,
    status: "open",
    closureBegin: null,
    closureEnd: null,
    closureReason: null,
    miles,
    name,
    managerLabel: cleanManager(
      str(g("ADMIN_ORG", "MANAGING_ORG", "Admin_Org", "Ownership", "maintenance_agency")),
    ),
    note: str(g("DESC_SEG", "use_restrict", "Sector", "CONDITION")),
    externalUrl: null,
    sourceLabel: "",
  };
};

const STATUS_CALLOUT: Record<
  "seasonal" | "closed",
  { intent: "warning" | "danger"; label: string }
> = {
  seasonal: { intent: "warning", label: "Seasonal — verify before you go" },
  closed: { intent: "danger", label: "Closed" },
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const v = readAttrs(attrs);
  return (
    <>
      {v.status !== "open" && (
        <MetricCallout
          title="Trail status"
          value={STATUS_CALLOUT[v.status].label}
          intent={STATUS_CALLOUT[v.status].intent}
          sub={
            v.closureBegin || v.closureEnd
              ? `Closure window: ${v.closureBegin ?? "—"} → ${v.closureEnd ?? "—"}`
              : undefined
          }
        />
      )}
      {v.miles !== null && (
        <HeroBlock caption="Length" value={v.miles.toFixed(v.miles >= 10 ? 0 : 1)} unit="miles" />
      )}
      <MetricGrid>
        {v.difficulty && (
          <MetricPill
            label="Difficulty"
            value={v.difficulty}
            intent={v.difficultyIntent}
            icon={Route}
          />
        )}
        {v.ada === true && (
          <MetricPill label="ADA" value="Accessible" intent="success" icon={Accessibility} />
        )}
        {v.managerLabel && <MetricPill label="Manager" value={v.managerLabel} />}
      </MetricGrid>
      {v.uses.length > 0 && <ChipRow items={v.uses.map((u) => `${labelForUse(u)}`)} />}
      {v.note && <Paragraph>{v.note}</Paragraph>}
      {v.status === "closed" && v.closureReason && (
        <TipBlock heading="Why it's closed" intent="danger">
          {v.closureReason}
        </TipBlock>
      )}
      {v.status === "seasonal" && (
        <TipBlock heading="Seasonal access" intent="warning">
          Conditions vary by month. Check the managing agency before you head out — snowpack, spring
          runoff, and bear closures all gate access on Montana trails.
        </TipBlock>
      )}
      {v.externalUrl && (
        <Paragraph>
          <a
            href={v.externalUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${v.name} on the managing agency's site (new tab)`}
            className="fwp-pill-button fwp-pill-button--sm"
          >
            <ExternalLink size={14} strokeWidth={2.25} aria-hidden />
            <span className="fwp-pill-button__label">Agency page</span>
          </a>
        </Paragraph>
      )}
    </>
  );
};

const labelForUse = (u: string): string => {
  switch (u) {
    case "hike":
      return "🥾 Hike";
    case "bike":
      return "🚴 Bike";
    case "horse":
      return "🐎 Horse";
    case "motorcycle":
      return "🏍️ Motorcycle";
    case "atv":
      return "🛻 ATV";
    case "ski":
      return "⛷️ Ski";
    case "snowmobile":
      return "🛷 Snowmobile";
    case "snowshoe":
      return "❄️ Snowshoe";
    default:
      return u;
  }
};

const summary = (attrs: Record<string, unknown>): string => {
  const v = readAttrs(attrs);
  return v.name || "Trail";
};

const subtitleForLayer =
  (layerId: string) =>
  (attrs: Record<string, unknown>): string | undefined => {
    const v = readAttrs(attrs);
    if (v.managerLabel) return v.managerLabel;
    // Raw-attr fallback (global-map tap) — fall through to the per-layer
    // agency label so the user always sees which agency owns the trail.
    return SOURCE_LABEL_BY_LAYER_ID[layerId];
  };

for (const layerId of SOURCE_LAYER_IDS) {
  registerFeature(layerId, {
    summary,
    subtitle: subtitleForLayer(layerId),
    Body,
    Actions: ({ attrs }) => {
      const v = readAttrs(attrs);
      if (!v.externalUrl) return null;
      return (
        <a
          href={v.externalUrl}
          target="_blank"
          rel="noreferrer"
          className="fwp-pill-button fwp-pill-button--sm"
          aria-label={`Open ${v.name} on the managing agency's site (new tab)`}
        >
          <Footprints size={14} strokeWidth={2.25} aria-hidden />
          <span className="fwp-pill-button__label">More info</span>
        </a>
      );
    },
    presentation: "panel",
  });
}
