/**
 * @file FreshnessChip.tsx
 * @module engage-mt/shared
 * @description Small chip showing a layer or dataset's freshness category and source.
 * Drives / docs/rules/data-freshness.md.
 *
 *              Added `stale` flag + compact variant so the
 *              chip can render inline in LayerPanel rows without
 *              dominating the row. Stale state turns the dot + label
 *              amber, adds a "Stale" suffix, and exposes a hidden text
 *              warning to screen readers.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-14
 * @version 1.4.0
 *
 * 1.2.0 — auto-flips realtime/hourly chips into an
 * "Offline · cached" state when the connectivity store reports the
 * device is offline. Every live card automatically signals stale data
 * without per-card wiring (the persona F8 "no offline badge on live
 * data" gap). Callers can override via the `offline` prop.
 *
 * 1.3.0 — Parity pass: `cached` prop appends "· cached" for ANY freshness
 * category (unlike `offline`, which only applies to realtime/hourly). Used
 * by versioned regs surfaces served from the Cache-Storage snapshot.
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { LayerFreshness } from "@/types/layers";
import { useConnectivityStore } from "@/store/app/connectivityStore";
import { formatAsOf } from "@/utils/relativeTime";
import { TOOLTIPS } from "@/copy/tooltips";
import "./FreshnessChip.css";

interface FreshnessChipProps {
  freshness: LayerFreshness | "versioned";
  source: string;
  /** ISO timestamp for realtime/hourly/daily/weekly layers (optional). */
  lastUpdate?: string;
  /** Effective date for versioned (Tier-2) datasets (optional). */
  effectiveDate?: string;
  /** When true, render in compact (LayerPanel inline) variant — drops source + lastUpdate. */
  compact?: boolean;
  /** When true, render the stale-data amber state. */
  stale?: boolean;
  /**
   * When true, append a "Sample" suffix indicating this data
   * is a placeholder fixture awaiting the live FWP wiring. Auto-inferred
   * from the `source` string when it contains "(sample fixture)".
   */
  sampleFixture?: boolean;
  /**
   * Force the offline-cached visual state. Leave undefined
   * to auto-derive from the connectivity store (only applies when the
   * underlying freshness is `realtime` or `hourly`, which are the only
   * categories that can be meaningfully stale-by-network).
   */
  offline?: boolean;
  /**
   * Parity pass — This data was served from the persisted Cache-Storage
   * snapshot rather than a fresh fetch. Appends "· cached" + the amber
   * stale visual for ANY freshness category (including `versioned`),
   * where `offline` does not apply. Mirrors the `sampleFixture` pattern.
   */
  cached?: boolean;
  /** Served from the copy saved to this device. */
  fieldCopy?: boolean;
  /** Served from the copy built into this app version. */
  bundled?: boolean;
}

// Tightened labels so the chip doesn't wrap in narrow popup
// headers. "Static reference" → "Static" reads cleanly and matches the
// existing "Live / Hourly / Daily / Weekly" single-word cadence.
const LABEL: Record<FreshnessChipProps["freshness"], string> = {
  realtime: "Live",
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  static: "Static",
  versioned: "Versioned",
};

// The steady-state explanation for each cadence — what "Hourly" actually
// promises. Lives in the TOOLTIPS catalog so the wording is shared, not
// re-invented per chip. The transient states (offline / cached / sample /
// stale) override this below; they describe a condition, not a cadence.
const CADENCE_TOOLTIP: Record<FreshnessChipProps["freshness"], string> = {
  realtime: TOOLTIPS.freshnessLive,
  hourly: TOOLTIPS.freshnessHourly,
  daily: TOOLTIPS.freshnessDaily,
  weekly: TOOLTIPS.freshnessWeekly,
  static: TOOLTIPS.freshnessStatic,
  versioned: TOOLTIPS.freshnessVersioned,
};

const CLASS: Record<FreshnessChipProps["freshness"], string> = {
  realtime: "freshness-chip--realtime",
  hourly: "freshness-chip--hourly",
  daily: "freshness-chip--daily",
  weekly: "freshness-chip--weekly",
  static: "freshness-chip--static",
  versioned: "freshness-chip--versioned",
};

export const FreshnessChip = ({
  freshness,
  source,
  lastUpdate,
  effectiveDate,
  compact = false,
  stale = false,
  sampleFixture,
  offline,
  cached = false,
  fieldCopy = false,
  bundled = false,
}: FreshnessChipProps): JSX.Element => {
  // Auto-infer from the source string so existing layer
  // callers benefit without prop drilling.
  const isSample = sampleFixture ?? /\(sample fixture\)/i.test(source);

  // Auto-flip to "Offline · cached" when the device is
  // offline AND the underlying freshness is one of the live-by-network
  // categories. Caller-supplied `offline` always wins.
  const online = useConnectivityStore((s) => s.online);
  const offlineEligible = freshness === "realtime" || freshness === "hourly";
  const isOffline = (offline ?? !online) && offlineEligible;

  const label =
    freshness === "versioned" && effectiveDate ? `Effective ${effectiveDate}` : LABEL[freshness];
  // Stored copies (browser cache, device copy, built-in) share the amber
  // visual with a suffix naming which copy this is.
  const showCached = cached && !isOffline;
  const copySuffix = showCached
    ? " · Cached"
    : fieldCopy
      ? " · Downloaded copy"
      : bundled
        ? " · Built-in copy"
        : "";
  const copyTitle = showCached
    ? "Served from the offline cache — may be behind the live FWP data"
    : fieldCopy
      ? "Copy saved to this device — may be behind the live FWP data"
      : bundled
        ? "Copy built into this app version — may be behind the live FWP data"
        : null;
  const cls = [
    "freshness-chip",
    CLASS[freshness],
    compact ? "freshness-chip--compact" : "",
    stale || isOffline || copyTitle ? "freshness-chip--stale" : "",
    isSample ? "freshness-chip--sample" : "",
    isOffline ? "freshness-chip--offline" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      className={cls}
      title={
        isOffline
          ? "Offline — showing last cached value"
          : copyTitle
            ? copyTitle
            : isSample
              ? "Sample fixture — awaiting FWP data wiring"
              : stale
                ? "Data may be stale"
                : CADENCE_TOOLTIP[freshness]
      }
    >
      <span className="freshness-chip__dot" aria-hidden="true" />
      <span className="freshness-chip__label">
        {label}
        {isOffline ? " · Offline · cached" : copySuffix || (stale ? " · Stale" : "")}
        {isSample ? " · Sample" : ""}
      </span>
      {!compact && (
        <>
          <span className="freshness-chip__sep" aria-hidden="true">
            ·
          </span>
          <span className="freshness-chip__source">{source}</span>
          {lastUpdate && (
            <>
              <span className="freshness-chip__sep" aria-hidden="true">
                ·
              </span>
              <time dateTime={lastUpdate} className="freshness-chip__updated">
                {/* Render a readable "as of 2 hr ago"; fall back to the raw
                    string when it isn't a parseable ISO timestamp. */}
                {formatAsOf(lastUpdate) ?? lastUpdate}
              </time>
            </>
          )}
        </>
      )}
      {isOffline && <span className="fwp-sr-only"> — offline, showing last cached value</span>}
      {copyTitle && !isOffline && <span className="fwp-sr-only"> — {copyTitle}</span>}
      {stale && !isOffline && !copyTitle && (
        <span className="fwp-sr-only"> — data may be out of date</span>
      )}
      {isSample && <span className="fwp-sr-only"> — sample fixture, not the live FWP feed</span>}
    </span>
  );
};
