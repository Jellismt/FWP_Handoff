/**
 * @file formatNumber.ts
 * @module engage-mt/utils
 * @description Smart number formatting for popup metric pills. ArcGIS
 *              feature attributes routinely return raw numerics like
 *              32586055.058 (acres of a hunting district) or 4823.0
 *              (lake surface acres) — rendered raw they read as noise.
 *              `formatCompact` collapses them to "32.6M ac" /
 *              "4,823 ac" depending on magnitude, with optional unit
 *              suffix.
 *
 *              Popup polish blitz. The goal is every
 *              MetricPill in the FeatureCard registry runs values
 *              through this helper rather than rendering
 *              `value.toLocaleString()` ad-hoc.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/**
 * Format a numeric value for display in a compact, scannable form:
 *
 *   formatCompact(32586055.058)        → "32.6M"
 *   formatCompact(32586055.058, "ac")  → "32.6M ac"
 *   formatCompact(4823, "ac")          → "4,823 ac"
 *   formatCompact(8275, "cfs")         → "8.3k cfs"
 *   formatCompact(82, "°F")            → "82°F"
 *   formatCompact(0.875)               → "0.88"
 *
 * Rules:
 *   - ≥ 10,000,000 → "32.6M" (millions, 1 decimal)
 *   - ≥ 100,000    → "342k"  (thousands, 0 decimal)
 *   - ≥ 10,000     → "12.3k" (thousands, 1 decimal)
 *   - ≥ 1,000      → "4,823" (locale grouping, 0 decimal)
 *   - ≥ 1          → integer or 1 decimal (rounded for whole units)
 *   - < 1          → 2 decimals
 *
 * Returns `"—"` for null/undefined/NaN — the universal "no value" glyph
 * for the popup system.
 */
export const formatCompact = (value: number | null | undefined, unit?: string): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  let body: string;
  if (abs >= 10_000_000) {
    body = `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  } else if (abs >= 1_000_000) {
    body = `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  } else if (abs >= 100_000) {
    body = `${sign}${Math.round(abs / 1_000).toLocaleString()}k`;
  } else if (abs >= 10_000) {
    body = `${sign}${(abs / 1_000).toFixed(1)}k`;
  } else if (abs >= 1_000) {
    body = `${sign}${Math.round(abs).toLocaleString()}`;
  } else if (abs >= 1) {
    // Whole-number units → integer; otherwise 1 decimal.
    body = Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
  } else {
    body = `${value.toFixed(2)}`;
  }

  if (!unit) return body;
  // Temperature units sit flush; other units get a thin space.
  if (unit === "°F" || unit === "°C" || unit === "°") return `${body}${unit}`;
  return `${body} ${unit}`;
};

/**
 * Format for cases where the full precision matters more than scannability
 * (e.g., GPS coordinates, scientific values, regulation citation numbers).
 * Falls back to `value.toLocaleString()` with optional decimal cap.
 */
export const formatExact = (value: number | null | undefined, maxDecimals = 2): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: maxDecimals,
  });
};
