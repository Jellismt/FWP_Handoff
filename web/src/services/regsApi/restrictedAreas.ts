/**
 * @file restrictedAreas.ts
 * @module engage-mt/services/regsApi
 * @description Restricted-area descriptions (printed pp.28-30, 46 areas) with their
 *              linked hunting districts, from the regs v2 API.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createRegsFetcher } from "./client";
import type { RestrictedArea } from "./types";

export const fetchRestrictedAreas = createRegsFetcher<RestrictedArea[]>({
  path: (year) => `/hunting/restricted-areas?year=${year}`,
  cacheKey: (year) => `restricted-areas-${year}`,
  label: (year) => `FWP ${year} restricted areas`,
});

/** Areas linked to a hunting district (by district_rarea in the regs DB). */
export function restrictedAreasForDistrict(rows: RestrictedArea[], hd: string): RestrictedArea[] {
  return rows.filter((r) => r.districts.includes(hd));
}

/** "WEAPONS_RESTR" → "weapons restriction" style display label. */
export function areaTypeLabel(areaType: string): string {
  const LABELS: Record<string, string> = {
    RESTRICTED: "Restricted area",
    WEAPONS_RESTR: "Weapons restriction area",
    CLOSURE: "Closure",
    ARCHERY_ONLY: "Archery only",
    MGMT_ZONE: "Management zone",
  };
  return LABELS[areaType] ?? areaType.replace(/_/g, " ").toLowerCase();
}
