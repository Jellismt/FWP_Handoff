/**
 * @file loadAntelope.ts
 * @module engage-mt/server/etl
 * @description Seeds antelope district opportunities from the 2026 DEA book's "Antelope HD
 *              Regulations" tables (printed pp.136-142, Regions 2-7) — the district-specific
 *              Antelope License (Either-sex) and Antelope B License (Doe/Fawn) rows plus the
 *              statewide/regional archery licenses (399-20 for Region 3, 900-20 for Regions
 *              4-7) and the Region-7 Yellowstone-River portion licenses (007-2x / 007-3x).
 *              Builds the full opportunity chain per row: ANTELOPE_HD district → hunt area
 *              (DISTRICT AHD-<code> for a single HD, MULTI for the statewide/portion
 *              licenses) → license_instrument (species=antelope) → animal class
 *              (ES_ANTELOPE / DOE_FAWN) → opportunity → season_window (ARCHERY + antelope
 *              general SEASON). The statewide 399-20 / 900-20 licenses carry a single
 *              Aug 15-Nov 08 SEASON window plus ARCHERY_EQUIP_ONLY + FIRST_CHOICE_ONLY
 *              restrictions ("First and only choice. ArchEquip only."). Idempotent: clears
 *              DRAFT antelope opportunities/instruments for the year first. Loads DRAFT.
 *              Usage: `tsx src/etl/loadAntelope.ts [year]` (default 2026).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-07
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { PoolClient } from "pg";
import { withTransaction, closePool, query } from "../db/pool.js";
import { resolveRange } from "./deaParse.js";

// Uniform across every printed antelope HD table (pp.136-142). NB: the month token must be
// the 3-letter form ("Sep", not "Sept") — resolveRange keys on exactly three letters.
const ARCHERY = "Sep 05-Oct 09";
const SEASON = "Oct 10-Nov 08";
// The statewide/regional "First and only choice. ArchEquip only." archery licenses (399-20,
// 900-20) list "-" in the Archery column and this single span in the Season column.
const STATEWIDE_ARCHERY_SEASON = "Aug 15-Nov 08";

// region, hd, districtName, license, class (ES=Either-sex | DF=Doe/Fawn), quota, qMin, qMax, note?
type Row = [number, string, string, string, "ES" | "DF", number, number, number, string?];

const ROWS: Row[] = [
  // ── Region 2 ──
  [2, "215", "East Deer Lodge", "215-20", "ES", 5, 1, 40],
  [2, "215", "East Deer Lodge", "215-30", "DF", 1, 1, 40],
  [2, "291", "East Garnet Range", "291-20", "ES", 1, 1, 30],
  [2, "291", "East Garnet Range", "291-30", "DF", 1, 1, 30],
  // ── Region 3 ──
  [3, "300", "Medicine Lodge-Upper Horse Prairie", "300-20", "ES", 125, 125, 300],
  [3, "300", "Medicine Lodge-Upper Horse Prairie", "300-30", "DF", 10, 10, 150],
  [3, "301", "Lima Peaks", "301-20", "ES", 20, 5, 30],
  [3, "310", "Pioneers", "310-20", "ES", 75, 50, 200],
  [3, "310", "Pioneers", "310-30", "DF", 50, 50, 300],
  [3, "311", "Lower Gallatin-Madison-Horseshoe Hills", "311-20", "ES", 75, 25, 150],
  [3, "313", "Upper Yellowstone", "313-20", "ES", 10, 10, 30],
  [3, "317", "West Boulder", "317-20", "ES", 50, 1, 250],
  [3, "318", "Big Hole", "318-20", "ES", 50, 5, 250],
  [3, "318", "Big Hole", "318-30", "DF", 50, 5, 250],
  [3, "319", "Fleecer-High Rye", "319-20", "ES", 50, 5, 150],
  [3, "319", "Fleecer-High Rye", "319-30", "DF", 50, 5, 150],
  [3, "320", "West Tobacco Roots", "320-20", "ES", 25, 25, 200],
  [3, "320", "West Tobacco Roots", "320-30", "DF", 50, 25, 200],
  [3, "322", "Sweetwater-Centennial", "322-20", "ES", 300, 100, 1000],
  [3, "322", "Sweetwater-Centennial", "322-30", "DF", 300, 100, 1000],
  [3, "329", "Horse Prairie North", "329-20", "ES", 100, 50, 300],
  [3, "338", "Shields River North", "338-20", "ES", 100, 1, 500],
  [3, "339", "Shields River South", "339-20", "ES", 75, 1, 300],
  [3, "340", "Highlands", "340-20", "ES", 350, 50, 400,
    "Successful antelope Either-sex 340-20 applicants may be offered the opportunity to purchase one or more doe/fawn 340-30 (Quota: 300, Range 50-500) licenses valid in HD 340 during the same time periods and with the same restrictions."],
  [3, "350", "Whitetail", "350-20", "ES", 55, 25, 100,
    "Successful antelope Either-sex 350-20 applicants may be offered the opportunity to purchase one or more doe/fawn 350-30 (Quota: 100, Range 25-200) licenses valid in HD 350 during the same time periods and with the same restrictions."],
  [3, "360", "Madison", "360-20", "ES", 350, 200, 700],
  [3, "370", "Boulder Valley", "370-20", "ES", 75, 25, 200,
    "Successful antelope Either-sex 370-20 applicants may be offered the opportunity to purchase one or more doe/fawn 370-30 (Quota: 100, Range 25-250) licenses valid in HD 370 during the same time periods and with the same restrictions."],
  [3, "371", "Radersburg", "371-20", "ES", 50, 25, 100],
  [3, "371", "Radersburg", "371-30", "DF", 25, 25, 125],
  [3, "380", "Winston Flats", "380-20", "ES", 10, 5, 25,
    "Not valid in HD 380 portion of the Townsend WRA, except with the use of ArchEquip."],
  [3, "381", "Hilger Valley-Silver City", "381-20", "ES", 15, 5, 50],
  [3, "388", "Ten Mile-Prickley Pear Valley", "388-20", "ES", 15, 15, 75,
    "Successful antelope Either-sex 388-20 applicants may be offered the opportunity to purchase one or more doe/fawn 388-31 (Quota: 30, Range 15-100) licenses valid in HD 388 during the same time periods and with the same restrictions. Valid both inside and outside Weapons Restriction Area."],
  [3, "390", "South Belts", "390-20", "ES", 25, 25, 100],
  [3, "390", "South Belts", "390-30", "DF", 50, 25, 125],
  // ── Region 4 ──
  [4, "401", "Sweetgrass Hills", "401-20", "ES", 200, 100, 500],
  [4, "401", "Sweetgrass Hills", "401-30", "DF", 50, 25, 500],
  [4, "404", "Teton-Marias", "404-20", "ES", 200, 75, 500],
  [4, "404", "Teton-Marias", "404-30", "DF", 100, 25, 600],
  [4, "413", "Sand Coulee", "413-20", "ES", 50, 25, 300],
  [4, "413", "Sand Coulee", "413-30", "DF", 50, 25, 300],
  [4, "420", "South Fergus", "420-20", "ES", 75, 5, 500],
  [4, "420", "South Fergus", "420-30", "DF", 25, 5, 500],
  [4, "430", "North Little Belt", "430-20", "ES", 150, 5, 300],
  [4, "430", "North Little Belt", "430-30", "DF", 100, 5, 300],
  [4, "440", "Birdtail Hills", "440-20", "ES", 125, 25, 300],
  [4, "440", "Birdtail Hills", "440-30", "DF", 100, 25, 300],
  [4, "441", "North Fork Birch Creek-Teton", "441-20", "ES", 20, 5, 25],
  [4, "444", "Teton-Highway 200", "444-20", "ES", 100, 25, 350],
  [4, "444", "Teton-Highway 200", "444-30", "DF", 50, 25, 300],
  [4, "450", "Hound Creek", "450-20", "ES", 75, 25, 250],
  [4, "450", "Hound Creek", "450-30", "DF", 75, 5, 400],
  [4, "455", "Ming Bar", "455-20", "ES", 2, 1, 15],
  [4, "471", "Highwoods-Denton", "471-20", "ES", 350, 25, 500],
  [4, "471", "Highwoods-Denton", "471-30", "DF", 450, 5, 650],
  [4, "480", "Judiths & Moccasins", "480-20", "ES", 100, 5, 300],
  [4, "480", "Judiths & Moccasins", "480-30", "DF", 100, 5, 500],
  [4, "481", "Petroleum", "481-20", "ES", 150, 5, 500],
  [4, "481", "Petroleum", "481-30", "DF", 100, 5, 500],
  [4, "485", "North Fergus", "485-20", "ES", 50, 5, 100],
  [4, "485", "North Fergus", "485-30", "DF", 50, 5, 100],
  [4, "490", "West Meagher", "490-20", "ES", 150, 125, 500],
  [4, "490", "West Meagher", "490-30", "DF", 125, 75, 900],
  // ── Region 5 ──
  [5, "506", "Big Timber", "506-20", "ES", 200, 50, 700],
  [5, "516", "East Wheatland - Willow Creek", "516-20", "ES", 700, 400, 1750],
  [5, "516", "East Wheatland - Willow Creek", "516-30", "DF", 50, 50, 3500],
  [5, "526", "Hardin", "526-20", "ES", 250, 100, 500],
  [5, "536", "Flatwillow-Willow Creek", "536-20", "ES", 300, 100, 1500],
  [5, "546", "West Wheatland", "546-20", "ES", 400, 200, 600],
  [5, "546", "West Wheatland", "546-30", "DF", 200, 50, 600],
  [5, "556", "Stillwater - Rock Creek", "556-20", "ES", 125, 100, 400],
  [5, "576", "Fish Creek-Big Coulee-Molt-Broadview-Billings", "576-20", "ES", 1100, 600, 3350],
  [5, "576", "Fish Creek-Big Coulee-Molt-Broadview-Billings", "576-30", "DF", 50, 50, 6300],
  [5, "586", "Two Dot", "586-20", "ES", 450, 200, 800],
  [5, "586", "Two Dot", "586-30", "DF", 200, 50, 1600],
  [5, "596", "Bull Mountains", "596-20", "ES", 300, 50, 300],
  [5, "596", "Bull Mountains", "596-30", "DF", 150, 50, 300],
  // ── Region 6 ──
  [6, "600", "North Hill-Blaine", "600-20", "ES", 400, 50, 1000],
  [6, "600", "North Hill-Blaine", "600-30", "DF", 100, 50, 1000],
  [6, "620", "South Phillips", "620-20", "ES", 600, 100, 2000],
  [6, "620", "South Phillips", "620-30", "DF", 100, 50, 1500],
  [6, "630", "South Valley", "630-20", "ES", 300, 10, 500],
  [6, "630", "South Valley", "630-30", "DF", 50, 5, 200],
  [6, "640", "Northeast Montana", "640-20", "ES", 125, 50, 300],
  [6, "640", "Northeast Montana", "640-30", "DF", 25, 10, 100],
  [6, "650", "McCone-Richland", "650-20", "ES", 700, 200, 1000],
  [6, "650", "McCone-Richland", "650-30", "DF", 250, 10, 300],
  [6, "670", "North Phillips-Valley", "670-20", "ES", 400, 25, 2000],
  [6, "670", "North Phillips-Valley", "670-30", "DF", 50, 10, 1200],
  [6, "690", "South Hill-Blaine-North Chouteau", "690-20", "ES", 500, 300, 1500],
  [6, "690", "South Hill-Blaine-North Chouteau", "690-30", "DF", 200, 50, 1500],
];

// Region-7 ANTELOPE_HD districts (names mirror their deer/elk counterparts). The antelope
// section only regulates them via the two Yellowstone-River portion groups below.
const R7_DISTRICTS: [string, string][] = [
  ["700", "Missouri Breaks-Prairie"],
  ["701", "Sagebrush Prairie"],
  ["702", "Yellowstone Pine Hills"],
  ["703", "Grassland-Agriculture"],
  ["704", "Powder Pine Hills"],
  ["705", "Prairie/Pines-Juniper Breaks"],
];

// Region-7 portion licenses (007-2x either-sex / 007-3x doe-fawn), each on a MULTI hunt area
// spanning the portion's member HDs. license, class, quota, qMin, qMax, memberHds, areaCode,
// areaLabel, note?
type PortionLicense = [string, "ES" | "DF", number, number, number, string[], string, string, string?];
const R7_PORTIONS: PortionLicense[] = [
  ["007-21", "ES", 3500, 1000, 4000, ["700", "701", "703"], "AHD-R7N",
    "Portions of HDs 700, 701, and 703 North of the Yellowstone River"],
  ["007-31", "DF", 500, 1, 3000, ["700", "701", "703"], "AHD-R7N",
    "Portions of HDs 700, 701, and 703 North of the Yellowstone River"],
  ["007-20", "ES", 6500, 2000, 8000, ["701", "702", "703", "704", "705"], "AHD-R7S",
    "Portions of HDs 701, 702, 703, 704, and 705 South of the Yellowstone River",
    "Successful antelope either-sex 007-20 applicants may be offered the opportunity to purchase one doe/fawn 705-30 (Quota: 750, Range 1-4,000) license valid in HD 705 during the same time periods."],
  ["007-30", "DF", 1000, 1, 5000, ["701", "702", "703", "704", "705"], "AHD-R7S",
    "Portions of HDs 701, 702, 703, 704, and 705 South of the Yellowstone River"],
];

// Statewide/regional "First and only choice. ArchEquip only." archery licenses. Each is ONE
// instrument (its quota is the total) valid across a MULTI hunt area of every HD it lists
// under in the pamphlet. license, quota, qMin, qMax, memberHds
type StatewideLicense = [string, number, number, number, string[]];
// 399-20 lists under every Region-3 HD EXCEPT 313 (which shows no 399-20 row).
const HDS_399 = ["300", "301", "310", "311", "317", "318", "319", "320", "322", "329", "338",
  "339", "340", "350", "360", "370", "371", "380", "381", "388", "390"];
// 900-20 lists under every Region 4-6 HD and both Region-7 portion groups (→ HDs 700-705).
const HDS_900 = [
  "401", "404", "413", "420", "430", "440", "441", "444", "450", "455", "471", "480", "481", "485", "490", // R4
  "506", "516", "526", "536", "546", "556", "576", "586", "596", // R5
  "600", "620", "630", "640", "650", "670", "690", // R6
  "700", "701", "702", "703", "704", "705", // R7
];
const STATEWIDE: StatewideLicense[] = [
  ["399-20", 500, 250, 750, HDS_399],
  ["900-20", 5600, 1, 7500, HDS_900],
];

const NOTE_ARCHERY = "First and only choice. ArchEquip only.";

const scalar = async (c: PoolClient, sql: string, params: unknown[]): Promise<string> =>
  (await c.query<{ v: string }>(sql, params)).rows[0]!.v;

export async function loadAntelope(seasonYear = Number(process.argv[2]) || 2026): Promise<void> {
  const sd = await query<{ v: string }>(`SELECT source_doc_id::text AS v FROM regs.source_document WHERE season_year=$1 LIMIT 1`, [seasonYear]);
  const sourceDocId = sd.rows[0]?.v ?? null;

  let opps = 0;
  await withTransaction("etl-antelope", async (c) => {
    // Idempotent: drop DRAFT antelope opportunities + instruments for the year.
    await c.query(
      `DELETE FROM regs.opportunity o USING regs.license_instrument li
        WHERE o.instrument_id=li.instrument_id AND o.season_year=$1 AND li.species_code='antelope' AND o.record_status='DRAFT'`, [seasonYear]);
    await c.query(`DELETE FROM regs.license_instrument WHERE season_year=$1 AND species_code='antelope' AND record_status='DRAFT'`, [seasonYear]);

    const districtCache = new Map<string, string>();
    const huntAreaCache = new Map<string, string>();
    const instrCache = new Map<string, string>();
    const classCache = new Map<string, string>();

    // District (ANTELOPE_HD) — look up, else create.
    const ensureDistrict = async (hd: string, region: number, name: string): Promise<string> => {
      let id = districtCache.get(hd) ?? null;
      if (id) return id;
      id = (await c.query<{ v: string }>(
        `SELECT district_id::text AS v FROM regs.district WHERE geography_code='ANTELOPE_HD' AND district_code=$1`, [hd])).rows[0]?.v ?? null;
      if (!id) {
        id = await scalar(c,
          `INSERT INTO regs.district (geography_code, district_code, region_id, district_name, first_season)
           VALUES ('ANTELOPE_HD',$1,$2,$3,$4) RETURNING district_id::text AS v`, [hd, region, name, seasonYear]);
      }
      districtCache.set(hd, id);
      return id;
    };

    // Single-district hunt area (AHD-<code>).
    const ensureAreaSingle = async (hd: string, districtId: string): Promise<string> => {
      const areaCode = `AHD-${hd}`;
      let id = huntAreaCache.get(areaCode) ?? null;
      if (id) return id;
      id = (await c.query<{ v: string }>(
        `SELECT hunt_area_id::text AS v FROM regs.hunt_area WHERE season_year=$1 AND area_code=$2`, [seasonYear, areaCode])).rows[0]?.v ?? null;
      if (!id) {
        id = await scalar(c,
          `INSERT INTO regs.hunt_area (season_year, area_code, area_kind, definition_text)
           VALUES ($1,$2,'DISTRICT',$3) RETURNING hunt_area_id::text AS v`, [seasonYear, areaCode, `Antelope HD ${hd}`]);
        await c.query(`INSERT INTO regs.hunt_area_member (hunt_area_id, member_seq, district_id) VALUES ($1,1,$2)`, [id, districtId]);
      }
      huntAreaCache.set(areaCode, id);
      return id;
    };

    // Multi-district hunt area (statewide archery / R7 portions).
    const ensureAreaMulti = async (areaCode: string, label: string, districtIds: string[]): Promise<string> => {
      let id = huntAreaCache.get(areaCode) ?? null;
      if (id) return id;
      id = (await c.query<{ v: string }>(
        `SELECT hunt_area_id::text AS v FROM regs.hunt_area WHERE season_year=$1 AND area_code=$2`, [seasonYear, areaCode])).rows[0]?.v ?? null;
      if (!id) {
        id = await scalar(c,
          `INSERT INTO regs.hunt_area (season_year, area_code, area_kind, definition_text)
           VALUES ($1,$2,'MULTI',$3) RETURNING hunt_area_id::text AS v`, [seasonYear, areaCode, label]);
        let seq = 1;
        for (const did of districtIds) {
          await c.query(`INSERT INTO regs.hunt_area_member (hunt_area_id, member_seq, district_id) VALUES ($1,$2,$3)`, [id, seq++, did]);
        }
      }
      huntAreaCache.set(areaCode, id);
      return id;
    };

    // Instrument — antelope-namespaced instr_code ("A<license>") to avoid colliding with
    // deer/elk permit numbers on the (season_year, instr_code) uniqueness constraint. The
    // printed license number is preserved verbatim in display_name.
    const ensureInstrument = async (license: string, cls: "ES" | "DF", quota: number, qMin: number, qMax: number): Promise<string> => {
      const instrCode = `A${license}`;
      let id = instrCache.get(instrCode) ?? null;
      if (id) return id;
      const instrType = cls === "DF" ? "B_SPECIES_LICENSE" : "SPECIES_LICENSE";
      const displayName = cls === "DF" ? `Antelope B License: ${license}` : `Antelope License: ${license}`;
      id = await scalar(c,
        `INSERT INTO regs.license_instrument
           (season_year, instr_type_code, species_code, instr_code, display_name, is_draw, quota_current, quota_unlimited, quota_min, quota_max, apply_by, updated_by, source_doc_id)
         VALUES ($1,$2,'antelope',$3,$4,1,$5,0,$6,$7,$8,'etl',$9) RETURNING instrument_id::text AS v`,
        [seasonYear, instrType, instrCode, displayName, quota, qMin, qMax, `${seasonYear}-06-01`, sourceDocId]);
      instrCache.set(instrCode, id);
      return id;
    };

    const ensureClass = async (cls: "ES" | "DF"): Promise<string> => {
      const classCode = cls === "ES" ? "ES_ANTELOPE" : "DOE_FAWN";
      let id = classCache.get(classCode) ?? null;
      if (id) return id;
      id = (await c.query<{ v: string }>(
        `SELECT animal_class_id::text AS v FROM regs.legal_animal_class WHERE species_code='antelope' AND class_code=$1`, [classCode])).rows[0]?.v ?? null;
      if (!id) {
        id = await scalar(c,
          `INSERT INTO regs.legal_animal_class (species_code, class_code, display_label) VALUES ('antelope',$1,$2) RETURNING animal_class_id::text AS v`,
          [classCode, cls === "ES" ? "Either-sex" : "Doe/Fawn"]);
      }
      classCache.set(classCode, id);
      return id;
    };

    const addWindow = async (oppId: string, raw: string, type: "ARCHERY" | "SEASON"): Promise<void> => {
      const r = resolveRange(raw, seasonYear);
      if (r) {
        await c.query(
          `INSERT INTO regs.season_window (opportunity_id, season_type_code, window_seq, starts_on, ends_on, raw_range) VALUES ($1,$2,1,$3,$4,$5)`,
          [oppId, type, r.starts_on, r.ends_on, raw]);
      }
    };

    const addRestriction = async (oppId: string, seq: number, code: string, valueText: string | null, rawText: string): Promise<void> => {
      await c.query(
        `INSERT INTO regs.opp_restriction (opportunity_id, restr_seq, restr_code, value_text, raw_text) VALUES ($1,$2,$3,$4,$5)`,
        [oppId, seq, code, valueText, rawText]);
    };

    // ── Standard per-HD rows ──
    for (const [region, hd, name, license, cls, quota, qMin, qMax, note] of ROWS) {
      const districtId = await ensureDistrict(hd, region, name);
      const huntAreaId = await ensureAreaSingle(hd, districtId);
      const instrumentId = await ensureInstrument(license, cls, quota, qMin, qMax);
      const classId = await ensureClass(cls);
      const oppId = await scalar(c,
        `INSERT INTO regs.opportunity
           (season_year, instrument_id, animal_class_id, hunt_area_id, split_seq, home_district_id, validity_note, updated_by, source_doc_id, raw_text)
         VALUES ($1,$2,$3,$4,1,$5,$6,'etl',$7,$8) RETURNING opportunity_id::text AS v`,
        [seasonYear, instrumentId, classId, huntAreaId, districtId, note ?? null, sourceDocId, `Antelope HD ${hd} ${license} ${cls}`]);
      opps++;
      await addWindow(oppId, ARCHERY, "ARCHERY");
      await addWindow(oppId, SEASON, "SEASON");
      if (note) await addRestriction(oppId, 1, "OTHER", null, note);
    }

    // Ensure Region-7 districts exist for the portion memberships.
    for (const [code, name] of R7_DISTRICTS) await ensureDistrict(code, 7, name);

    // ── Region-7 portion licenses (007-2x / 007-3x) ──
    for (const [license, cls, quota, qMin, qMax, memberHds, areaCode, areaLabel, note] of R7_PORTIONS) {
      const districtIds = await Promise.all(memberHds.map((hd) => districtCache.get(hd)!));
      const huntAreaId = await ensureAreaMulti(areaCode, areaLabel, districtIds);
      const instrumentId = await ensureInstrument(license, cls, quota, qMin, qMax);
      const classId = await ensureClass(cls);
      const oppId = await scalar(c,
        `INSERT INTO regs.opportunity
           (season_year, instrument_id, animal_class_id, hunt_area_id, split_seq, home_district_id, validity_note, updated_by, source_doc_id, raw_text)
         VALUES ($1,$2,$3,$4,1,NULL,$5,'etl',$6,$7) RETURNING opportunity_id::text AS v`,
        [seasonYear, instrumentId, classId, huntAreaId, note ?? null, sourceDocId, `Antelope R7 ${areaCode} ${license} ${cls}`]);
      opps++;
      await addWindow(oppId, ARCHERY, "ARCHERY");
      await addWindow(oppId, SEASON, "SEASON");
      if (note) await addRestriction(oppId, 1, "OTHER", null, note);
    }

    // ── Statewide / regional archery licenses (399-20, 900-20) ──
    for (const [license, quota, qMin, qMax, memberHds] of STATEWIDE) {
      const districtIds = await Promise.all(memberHds.map((hd) => districtCache.get(hd)!));
      const huntAreaId = await ensureAreaMulti(`A${license}`, `Antelope archery license ${license}`, districtIds);
      const instrumentId = await ensureInstrument(license, "ES", quota, qMin, qMax);
      const classId = await ensureClass("ES");
      const oppId = await scalar(c,
        `INSERT INTO regs.opportunity
           (season_year, instrument_id, animal_class_id, hunt_area_id, split_seq, home_district_id, validity_note, updated_by, source_doc_id, raw_text)
         VALUES ($1,$2,$3,$4,1,NULL,$5,'etl',$6,$7) RETURNING opportunity_id::text AS v`,
        [seasonYear, instrumentId, classId, huntAreaId, NOTE_ARCHERY, sourceDocId, `Antelope statewide ${license} ES`]);
      opps++;
      await addWindow(oppId, STATEWIDE_ARCHERY_SEASON, "SEASON");
      await addRestriction(oppId, 1, "ARCHERY_EQUIP_ONLY", null, NOTE_ARCHERY);
      await addRestriction(oppId, 2, "FIRST_CHOICE_ONLY", null, NOTE_ARCHERY);
    }
  });
  const n = await query<{ n: string }>(
    `SELECT count(*) AS n FROM regs.opportunity o JOIN regs.license_instrument li ON li.instrument_id=o.instrument_id WHERE o.season_year=$1 AND li.species_code='antelope'`, [seasonYear]);
  console.log(`Antelope for ${seasonYear}: loaded ${opps} opportunities (${n.rows[0]!.n} total antelope, DRAFT).`);
}

const isMain = process.argv[1]?.endsWith("loadAntelope.ts") || process.argv[1]?.endsWith("loadAntelope.js");
if (isMain) {
  loadAntelope().then(() => closePool()).then(() => process.exit(0)).catch((e) => { console.error(e); void closePool().finally(() => process.exit(1)); });
}
