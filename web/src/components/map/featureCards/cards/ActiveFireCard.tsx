/**
 * @file ActiveFireCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for NIFC active fire perimeters.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Flame } from "lucide-react";
import {
  BadgeRow,
  DomainPill,
  MetricGrid,
  MetricPill,
  Paragraph,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { formatCompact } from "@/utils/formatNumber";
import { ConditionBar } from "@/components/shared/charts/ConditionBar";

// Small inline "X ago" formatter for perimeter freshness. NIFC stamps
// ModifiedOnDateTime as ISO 8601; this returns a short human-readable
// distance ("3h ago", "2d ago") without pulling in date-fns. Returns
// null when the timestamp can't be parsed.
// NIFC's date fields arrive in three shapes:
//   1. ISO 8601 string  ("2025-08-15T14:30:00Z")
//   2. epoch milliseconds as a stringified number (Esri's wire default,
//      ~13 digits: "1773687968000")
//   3. epoch seconds as a stringified number (~10 digits: "1773687968")
// Previously we just `.slice(0, 10)` whatever came through which produced
// "2025-08-15" for ISO but "1773687968" for an epoch — the user saw a
// raw 10-digit Unix timestamp in the Discovered pill. Normalize to a
// real Date before formatting.
const parseAnyDate = (raw: string | null): Date | null => {
  if (!raw) return null;
  if (/^-?\d+$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    // 10 digits → seconds; anything larger → already milliseconds. Cutoff
    // 10^12 keeps the millisecond branch for dates Jan 2001 onward, which
    // covers everything NIFC reports.
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t);
};

const formatDate = (raw: string | null): string | null => {
  const d = parseAnyDate(raw);
  if (!d) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const formatTimeAgo = (raw: string | null): string | null => {
  const d = parseAnyDate(raw);
  if (!d) return null;
  const ms = Date.now() - d.getTime();
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// IncidentTypeCategory normalization. NIFC ships several
// distinct strings ("Wildfire", "WF", "Prescribed Fire", "RX", "Non-
// Wildfire", "NWCG"). Collapse to three buckets that match the reference labels.
const normalizeIncidentType = (raw: string | null): string | null => {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t.includes("prescribed") || t === "rx") return "Prescribed";
  if (t.includes("non") || t === "nwcg") return "Non-wildfire";
  if (t.includes("wildfire") || t === "wf") return "Wildfire";
  // Preserve the raw value so unfamiliar categories aren't silently dropped.
  return raw;
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const acres = num(get("DailyAcres", "IncidentSize", "GISAcres", "acres"));
  const discoveryAcres = num(get("DiscoveryAcres"));
  const contained = num(get("PercentContained", "percentcontained", "containment"));
  const discovered = str(get("FireDiscoveryDateTime", "FireDiscoveryDate", "StartDate"));
  const modified = str(get("ModifiedOnDateTime"));
  const agency = str(get("POOResponsibleAgency", "POOLandownerKind", "Owner"));
  const county = str(get("POOCounty"));
  const state = str(get("POOState"));
  const cause = str(get("FireCause", "FireCauseGeneral"));
  const incidentType = normalizeIncidentType(str(get("IncidentTypeCategory", "IncidentTypeKind")));

  // Growth signal vs discovery size. Positive means the
  // fire has grown since first reporting — the
  // single most actionable trend on a wildfire popup.
  const growthAcres =
    acres !== null && discoveryAcres !== null && acres > discoveryAcres
      ? Math.round(acres - discoveryAcres)
      : null;

  // Location eyebrow under the name.
  const locationLine =
    county && state ? `${county} County, ${state}` : county ? `${county} County` : (state ?? null);

  const updatedAgo = formatTimeAgo(modified);
  // Pre-pick containment segment colors from the fire domain ramp so they
  // line up with the hero accent. Brand tokens land via brand-tokens.css.
  const containmentSegments = [
    { label: "Uncontained 0–25%", weight: 25, color: "var(--fwp-danger)" },
    { label: "Partial 25–60%", weight: 35, color: "var(--fwp-warning)" },
    { label: "Holding 60–90%", weight: 30, color: "var(--fwp-success)" },
    { label: "Contained 90–100%", weight: 10, color: "var(--fwp-green-mid)" },
  ];

  return (
    <>
      {/* Burned area as a flat pill (matches the Discovered / Cause pills)
          rather than a raised hero, per design. */}
      <MetricGrid>
        <MetricPill
          label="Burned area"
          value={acres !== null ? `${formatCompact(acres)} acres` : "Size pending"}
        />
      </MetricGrid>
      {incidentType && (
        <BadgeRow
          badges={[
            // Theme yellow — the alarm-red tint read as an error state.
            { icon: Flame, label: incidentType, intent: "accent" },
          ]}
        />
      )}
      {locationLine && <Paragraph>{locationLine}</Paragraph>}
      {contained !== null && (
        <ConditionBar
          caption="Containment"
          segments={containmentSegments}
          marker={contained / 100}
          readout={`${contained.toFixed(0)}%`}
          ariaLabel={`Containment ${contained.toFixed(0)} percent`}
        />
      )}
      <MetricGrid>
        {growthAcres !== null && (
          <DomainPill
            label="Growth"
            value={`+${formatCompact(growthAcres)} ac`}
            domain="fire"
            intent="warning"
          />
        )}
        {discovered && (
          <MetricPill
            label="Discovered"
            value={formatDate(discovered) ?? discovered.slice(0, 10)}
          />
        )}
        {cause && <MetricPill label="Cause" value={cause} />}
        {(updatedAgo || modified) && (
          <MetricPill
            label="Updated"
            value={updatedAgo ?? formatDate(modified) ?? modified!.slice(0, 10)}
          />
        )}
      </MetricGrid>
      {/* The incident name is already the card title — only the agency
          (when present) is new information down here. */}
      {agency && <Paragraph>{`Agency: ${agency}`}</Paragraph>}
    </>
  );
};

const fireRendererSpec = {
  // The body carries incident identity — no provenance strip.
  hideMeta: true,
  summary: (a: Record<string, unknown>) =>
    String(a.IncidentName ?? a.incidentName ?? a.Name ?? "Active Fire"),
  subtitle: () => "Wildfire incident",
  Body,
};

// Point companion to the perimeter polygon layer. Shares
// the same attribute schema (both come from NIFC IRWIN) so the card
// renderer is identical; only the layer geometry differs.
registerFeature("active-fires-points", fireRendererSpec);
