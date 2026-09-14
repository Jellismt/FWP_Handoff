/**
 * @file relativeTime.ts
 * @module engage-mt/utils
 * @description Human "as of …" relative-time formatting for freshness stamps.
 *              Turns an ISO timestamp into a short, plain-English age ("just
 *              now", "5 min ago", "2 hr ago", "3 days ago") so cached / last-good
 *              values read honestly instead of showing a raw ISO string. Older
 *              than a week falls back to a plain date. Returns null when the
 *              input isn't a parseable timestamp, so callers can render the raw
 *              value unchanged (backward compatible).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * Format an ISO timestamp as a short relative age, or null if unparseable.
 * Examples: "just now", "5 min ago", "2 hr ago", "3 days ago", "Jul 1".
 */
export const formatRelativeTime = (iso: string): string | null => {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const delta = Date.now() - then;
  if (delta < 0) return "just now";
  if (delta < MINUTE_MS) return "just now";
  if (delta < HOUR_MS) {
    const m = Math.floor(delta / MINUTE_MS);
    return `${m} min ago`;
  }
  if (delta < DAY_MS) {
    const h = Math.floor(delta / HOUR_MS);
    return `${h} hr ago`;
  }
  if (delta < WEEK_MS) {
    const d = Math.floor(delta / DAY_MS);
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** As `formatRelativeTime`, prefixed "as of …". Null when unparseable. */
export const formatAsOf = (iso: string): string | null => {
  const rel = formatRelativeTime(iso);
  return rel ? `as of ${rel}` : null;
};
