/**
 * @file districtNotes.ts
 * @module engage-mt/services/regsApi
 * @description Per-district NOTEs (CWD sampling mandates, closures, agency phone numbers)
 *              from the regs v2 API's published_district_notes snapshot — the data the
 *              District Regulations panel's "District notes" TipBlock renders.
 *              Pamphlet page references ("(p 28-30)") are stripped on the way in:
 *              they cite a print layout the app doesn't present.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-16
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createRegsFetcher } from "./client";
import type { DistrictNotes } from "./types";

export const fetchDistrictNotes = createRegsFetcher<DistrictNotes[]>({
  path: (year) => `/hunting/district-notes?year=${year}`,
  cacheKey: (year) => `district-notes-${year}`,
  label: (year) => `FWP ${year} district notes`,
});

/** Pamphlet page citations — "(p 28-30)", "(p. 12)", "(pp 5–6)" — in any position. */
const PAGE_REF = /\s*\(p{1,2}\.?\s*\d+(?:\s*[-–—]\s*\d+)?\)/gi;

/** Strip print-pamphlet page references from a note; collapse any doubled spaces left behind. */
function stripPageRefs(note: string): string {
  return note.replace(PAGE_REF, "").replace(/ {2,}/g, " ").trim();
}

/** district_code → notes[] lookup map (a district may appear under two geographies —
 *  HD and ANTELOPE_HD share codes in places — so notes for the same code merge). */
export function notesByDistrict(rows: DistrictNotes[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rows) {
    const list = m.get(r.district_code) ?? [];
    list.push(...r.notes.map(stripPageRefs).filter((n) => n.length > 0));
    m.set(r.district_code, list);
  }
  return m;
}
