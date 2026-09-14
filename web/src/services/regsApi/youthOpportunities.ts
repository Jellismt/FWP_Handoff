/**
 * @file youthOpportunities.ts
 * @module engage-mt/services/regsApi
 * @description Youth / PTHFV special opportunities (derived from opportunity restrictions,
 *              mirrors the printed p.124 table) from the regs v2 API.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createRegsFetcher } from "./client";
import type { YouthOpportunity } from "./types";

export const fetchYouthOpportunities = createRegsFetcher<YouthOpportunity[]>({
  path: (year) => `/hunting/youth-opportunities?year=${year}`,
  cacheKey: (year) => `youth-opportunities-${year}`,
  label: (year) => `FWP ${year} youth & PTHFV opportunities`,
});

/** Rows valid in a given hunting district. */
export function youthOpportunitiesForDistrict(
  rows: YouthOpportunity[],
  hd: string,
): YouthOpportunity[] {
  return rows.filter((r) => r.district_code === hd);
}
