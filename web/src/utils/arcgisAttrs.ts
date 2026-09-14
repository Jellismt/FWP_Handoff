/**
 * @file arcgisAttrs.ts
 * @module engage-mt/utils
 * @description The sanctioned home for narrowing ArcGIS feature attributes.
 *              ArcGIS REST returns schema-free `Record<string, unknown>`
 *              attribute bags whose field casing + types vary by service
 *              (NAME / Name / name; numbers that arrive as numeric strings;
 *              booleans as 0/1 or "Yes"/"No"). Several services + feature-card
 *              renderers hand-rolled their own `asString` / `String(a.NAME ??
 *              a.Name ?? …)` narrowing; this module consolidates the safe,
 *              partial-data-tolerant coercions so callers stop re-implementing
 *              them. Per the audit + the "if the same shape appears
 *              in 2+ files, add a helper" bar in `esriCast.ts`.
 *
 *              These are pure, defensive, and return null (never throw) on a
 *              missing/mistyped field, matching the partial-data tolerance
 *              renderers require (`docs/rules/feature-cards.md`).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** An ArcGIS feature's attribute bag — schema-free by nature. */
export type ArcgisAttrs = Record<string, unknown>;

/**
 * Coerce a single attribute value to a trimmed, non-empty string, or null.
 * A finite number stringifies (an integer district id → "380"); everything
 * else (empty string, null, object, NaN) → null.
 */
export const asString = (v: unknown): string | null => {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
};

/**
 * Coerce a single value to a finite number, parsing numeric strings (ArcGIS
 * frequently ships numbers as strings). Non-finite / non-numeric → null.
 */
export const asNumber = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * Coerce a single value to a boolean, accepting the shapes ArcGIS uses for
 * flags: a real boolean, 0/1, or "true"/"false"/"yes"/"no"/"y"/"n" (any case).
 * Anything else → null so callers can distinguish "false" from "unknown".
 */
export const asBoolean = (v: unknown): boolean | null => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
    return null;
  }
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "yes" || s === "y" || s === "1") return true;
    if (s === "false" || s === "no" || s === "n" || s === "0") return false;
  }
  return null;
};

/**
 * First of `keys` whose attribute value is a non-empty string, else `fallback`
 * (default `""`). Replaces the `String(a.NAME ?? a.Name ?? a.name ?? "…")`
 * coalescing chain that recurs across feature-card summaries — the multi-key
 * form makes the case-variant tolerance explicit and null-safe.
 */
export const attrStr = (attrs: ArcgisAttrs, keys: readonly string[], fallback = ""): string => {
  for (const k of keys) {
    const s = asString(attrs[k]);
    if (s !== null) return s;
  }
  return fallback;
};

/** First of `keys` whose value coerces to a finite number, else null. */
export const attrNum = (attrs: ArcgisAttrs, keys: readonly string[]): number | null => {
  for (const k of keys) {
    const n = asNumber(attrs[k]);
    if (n !== null) return n;
  }
  return null;
};
