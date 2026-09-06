/**
 * @file guideExample.ts
 * @module engage-mt/staff
 * @description The single running worked example threaded through every User Guide chapter:
 *              Hunting District 270 (East Fork Bitterroot, Region 2) — a real seeded HD rich
 *              with a General license, draw Permits, and B-Licenses across deer and elk, so
 *              one district demonstrates OTC-vs-draw, quota-vs-unlimited, and shared
 *              instruments. Row data mirrors the seeded 2026 DEA data
 *              (server/src/etl/deer-elk-districts-2026.json) so the reproductions read true.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { BookRowExample } from "./guidePrimitives.js";

/** The worked-example district — reused in every chapter's mock + deep-link. */
export const WORKED_EXAMPLE_DISTRICT = "270";
export const WORKED_EXAMPLE_NAME = "East Fork Bitterroot";
export const WORKED_EXAMPLE_REGION = 2;
/** Route to the live district-detail screen for the worked example. */
export const WORKED_EXAMPLE_ROUTE = `/districts/${WORKED_EXAMPLE_DISTRICT}`;

/** The deer/elk season columns, in printed order. Antelope uses a single "Season". */
export const DEER_ELK_SEASON_COLS = ["Early", "Archery", "General", "Muzzleloader", "Late"];

const ARCHERY = "Sep 5–Oct 18";
const GENERAL = "Oct 24–Nov 29";

/** A representative slice of HD 270's deer rows (General, B-License, Permit). */
export const HD270_DEER: BookRowExample[] = [
  {
    instrCode: "GEN-deer",
    instrumentName: "General Deer License",
    legalAnimal: "Either-sex White-tailed Deer",
    seasons: { Archery: ARCHERY, General: GENERAL },
    quota: "–",
    restrictions: "Private land only",
  },
  {
    instrCode: "270-01",
    instrumentName: "Deer B License",
    legalAnimal: "Antlerless Mule Deer",
    seasons: { Archery: ARCHERY, General: GENERAL },
    quota: "25 (1–150)",
  },
  {
    instrCode: "270-50",
    instrumentName: "Deer Permit",
    isDraw: true,
    legalAnimal: "Antlered Buck Mule Deer",
    seasons: { Archery: ARCHERY, General: GENERAL },
    quota: "45",
    restrictions: "Use with a General license",
  },
];

/** A representative slice of HD 270's elk rows (General, B-License, Permit). */
export const HD270_ELK: BookRowExample[] = [
  {
    instrCode: "GEN-elk",
    instrumentName: "General Elk License",
    legalAnimal: "Brow-tined Bull Elk",
    seasons: { Archery: ARCHERY, General: GENERAL },
    quota: "–",
    restrictions: "Youth ages 12–15",
  },
  {
    instrCode: "270-01",
    instrumentName: "Elk B License",
    legalAnimal: "Antlerless Elk",
    seasons: { Archery: ARCHERY, General: GENERAL },
    quota: "300 (10–400)",
    restrictions: "North of Rye Creek",
  },
  {
    instrCode: "270-45",
    instrumentName: "Elk Permit",
    isDraw: true,
    legalAnimal: "Brow-tined Bull Elk",
    seasons: { Archery: ARCHERY, General: GENERAL },
    quota: "UNL",
    restrictions: "One per hunter",
  },
];
