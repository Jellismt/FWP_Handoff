/**
 * @file corrections.ts
 * @module engage-mt/services/regsApi
 * @description Mid-season regulation corrections: each row is a publication
 *              flagged as a correction, with the version that carried it and
 *              the species and districts it affects. Splitting them against
 *              the version a reader was actually served tells the UI which
 *              corrections that copy already includes and which it is missing.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createRegsFetcher } from "./client";

export interface RegsCorrection {
  version: number;
  published_at: string;
  summary: string | null;
  affected_species: string | null;
  affected_districts: string | null;
  note: string | null;
}

export const fetchCorrections = createRegsFetcher<RegsCorrection[]>({
  path: (year) => `/hunting/corrections?year=${year}`,
  cacheKey: (year) => `corrections-${year}`,
  label: (year) => `FWP ${year} regulation corrections`,
});

/** District codes named by a correction; an empty list means every district. */
export const affectedDistricts = (c: RegsCorrection): string[] =>
  (c.affected_districts ?? "").match(/\d{3}/g) ?? [];

export const affectsDistrict = (c: RegsCorrection, hd: string): boolean => {
  const codes = affectedDistricts(c);
  return codes.length === 0 || codes.includes(hd);
};

export interface SplitCorrections {
  /** Newer than the version the reader was served: the copy on screen lacks them. */
  missing: RegsCorrection[];
  /** Already folded into the served version. */
  included: RegsCorrection[];
}

export const splitCorrections = (
  rows: readonly RegsCorrection[],
  servedVersion: number | null,
): SplitCorrections => {
  const sorted = [...rows].sort((a, b) => b.version - a.version);
  if (servedVersion === null) return { missing: [], included: sorted };
  return {
    missing: sorted.filter((c) => c.version > servedVersion),
    included: sorted.filter((c) => c.version <= servedVersion),
  };
};
