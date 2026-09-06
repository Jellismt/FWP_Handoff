/**
 * @file formatDate.ts
 * @module engage-mt/utils
 * @description Shared date formatting helpers.
 *
 *              Season windows are not formatted here: authoritative per-species
 *              windows come pre-humanized from the FWP Regs Manager via
 *              `services/hunt/districtSeasonWindows.ts`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/**
 * SP-7: full localized date — "Jan 5, 2026" (numeric year, short month,
 * numeric day). Returns the raw input on an unparseable date rather than
 * throwing. Consolidates the byte-identical `formatDate(iso)` helper that was
 * copy-pasted into WaypointCard / TrackCard / ShapeCard.
 */
export const formatFullDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};
