/**
 * @file guideChapters.ts
 * @module engage-mt/staff
 * @description The ordered chapter registry for the embedded User Guide. Each entry pairs a
 *              stable anchor `id` (for the "On this page" jump list + deep-linking) and a
 *              title with the chapter component that renders it, plus an optional printed-book
 *              page reference. UserGuideScreen renders these in order.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { WelcomeChapter } from "./chapters/01-Welcome.js";
import { SeasonYearChapter } from "./chapters/02-SeasonYear.js";
import { FindingADistrictChapter } from "./chapters/03-FindingADistrict.js";
import { ReadingTheMoneyScreenChapter } from "./chapters/04-ReadingTheMoneyScreen.js";
import { EditingASeasonChapter } from "./chapters/05-EditingASeason.js";
import { EditingAnInstrumentChapter } from "./chapters/06-EditingAnInstrument.js";
import { HuntAreasChapter } from "./chapters/07-HuntAreas.js";
import { RestrictedAreasChapter } from "./chapters/08-RestrictedAreas.js";
import { ReferenceDataChapter } from "./chapters/09-ReferenceData.js";
import { ValidatingChapter } from "./chapters/10-Validating.js";
import { PublishingChapter } from "./chapters/11-Publishing.js";
import { AuditRolesVocabChapter } from "./chapters/12-AuditRolesVocab.js";

/** One User Guide chapter. `id` is the URL anchor + jump-list target. */
export interface GuideChapter {
  id: string;
  title: string;
  /** Optional printed-book page reference shown as a pill next to the title. */
  bookRef?: string;
  Component: React.ComponentType;
}

export const GUIDE_CHAPTERS: GuideChapter[] = [
  { id: "welcome", title: "1 · Welcome", Component: WelcomeChapter },
  { id: "season-year", title: "2 · The season year is your book edition", Component: SeasonYearChapter },
  { id: "finding-a-district", title: "3 · Finding your district", bookRef: "Region maps", Component: FindingADistrictChapter },
  { id: "money-screen", title: "4 · Reading the district table", bookRef: "Printed pp. 48–123", Component: ReadingTheMoneyScreenChapter },
  { id: "editing-a-season", title: "5 · Editing a season, step by step", Component: EditingASeasonChapter },
  { id: "editing-an-instrument", title: "6 · Editing an instrument & quota", Component: EditingAnInstrumentChapter },
  { id: "hunt-areas", title: "7 · Hunt areas — one row, many districts", bookRef: "Printed pp. 126–127", Component: HuntAreasChapter },
  { id: "restricted-areas", title: "8 · Restricted areas", bookRef: "Printed pp. 28–30", Component: RestrictedAreasChapter },
  { id: "reference-data", title: "9 · The rest of the book", bookRef: "Fees · dates · contacts", Component: ReferenceDataChapter },
  { id: "validating", title: "10 · Validating before you publish", Component: ValidatingChapter },
  { id: "publishing", title: "11 · Publishing, snapshots & the printed book", Component: PublishingChapter },
  { id: "audit-roles", title: "12 · Audit log, roles & what you can't edit", Component: AuditRolesVocabChapter },
];
