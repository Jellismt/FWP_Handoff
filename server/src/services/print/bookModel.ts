/**
 * @file bookModel.ts
 * @module engage-mt/server/services/print
 * @description Assembles the ordered "book model" for a season year from the DB —
 *              content sections, the fee chart, and per-region → per-district → per-species
 *              regulation tables (the 10-column layout) + restricted areas. Both the HTML
 *              proof and the ICML exporter render from this one model. Reads current
 *              DRAFT+PUBLISHED rows (what the next book will contain).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { query } from "../../db/pool.js";

export interface BookOppRow {
  instrCode: string; instrumentName: string; species: string; legalAnimal: string;
  quota: string; applyBy: string; windows: Record<string, string>;
  restrictions: string; splitSeq: number;
}
export interface BookDistrict { districtCode: string; districtName: string | null; geography: string; notes: string[]; opps: BookOppRow[]; }
export interface BookRegion { regionId: number; regionName: string; districts: BookDistrict[]; }
export interface BookContent { slug: string; category: string; title: string; bodyMd: string; statuteRefs: string | null; }
export interface BookFeeProduct { code: string; name: string; kind: string; applyBy: string | null; chartNote: string | null; prices: Record<string, number>; }
export interface BookRArea { areaType: string; areaName: string; legalDesc: string | null; districts: string[]; }
export interface BookImportantDate { dateKind: string; speciesScope: string | null; label: string; startsOn: string | null; endsOn: string | null; note: string | null; }
export interface BookContact { kind: string; name: string; org: string | null; address: string | null; city: string | null; phone: string | null; phone2: string | null; email: string | null; url: string | null; note: string | null; }
export interface BookSunriseZone { zoneNo: number; zoneName: string; counties: string[]; times: { month: number; day: number; rise: number; set: number }[]; }
export interface BookAsset { kind: string; title: string; caption: string | null; regionId: number | null; geography: string | null; cmsDocId: string; }
export interface BookModel {
  seasonYear: number;
  content: BookContent[];
  fees: BookFeeProduct[];
  regions: BookRegion[];
  restrictedAreas: BookRArea[];
  importantDates: BookImportantDate[];
  contacts: BookContact[];
  sunrise: BookSunriseZone[];
  assets: BookAsset[];
}

/**
 * Book-order category sequence (the printed pamphlet's chapter order). content_section rows
 * are grouped by category and emitted in this order — NOT category-alphabetical. Categories
 * not listed fall to the end (OTHER). The regions/restricted-areas/sunrise/contacts sections
 * are placed by the renderer relative to these (see proofHtml).
 */
export const BOOK_CATEGORY_ORDER = [
  "FRONT_MATTER", "CWD", "DEFINITIONS", "LICENSING", "DRAWING",
  "YOUTH", "DISABILITY", "LAWS_RULES", "ACCESS", "SAFETY", "OTHER",
] as const;
export const bookCategoryRank = (cat: string): number => {
  const i = (BOOK_CATEGORY_ORDER as readonly string[]).indexOf(cat);
  return i === -1 ? BOOK_CATEGORY_ORDER.length : i;
};

const SEASON_LABEL: Record<string, string> = { EARLY: "Early", ARCHERY: "Archery", GENERAL: "General", HERITAGE_ML: "Muzzleloader", LATE: "Late", SEASON: "Season" };
export const BOOK_SEASON_COLS = ["EARLY", "ARCHERY", "GENERAL", "HERITAGE_ML", "LATE"] as const;
export const bookSeasonLabel = (s: string): string => SEASON_LABEL[s] ?? s;

export async function buildBookModel(seasonYear: number): Promise<BookModel> {
  const content = (await query<{ slug: string; category: string; title: string; body_md: string; statute_refs: string | null }>(
    `SELECT slug, category, title, body_md, statute_refs FROM regs.content_section
     WHERE season_year=$1 AND record_status <> 'ARCHIVED' ORDER BY category, sort_order`, [seasonYear],
  )).rows.map((r) => ({ slug: r.slug, category: r.category, title: r.title, bodyMd: r.body_md, statuteRefs: r.statute_refs }))
    // Re-order category groups into printed-book order (stable sort keeps within-category sort_order).
    .sort((a, b) => bookCategoryRank(a.category) - bookCategoryRank(b.category));

  const feeRows = (await query<{ product_code: string; display_name: string; product_kind: string; apply_by: string | null; chart_note: string | null; sort_order: number; audience_code: string; price_cents: number }>(
    `SELECT lp.product_code, lp.display_name, lp.product_kind, to_char(lp.apply_by,'FMMon DD') AS apply_by, lp.chart_note, lp.sort_order, pp.audience_code, pp.price_cents
     FROM regs.license_product lp JOIN regs.product_price pp ON pp.product_id=lp.product_id
     WHERE lp.season_year=$1 AND lp.record_status <> 'ARCHIVED' ORDER BY lp.sort_order, lp.product_code`, [seasonYear],
  )).rows;
  const feeMap = new Map<string, BookFeeProduct>();
  for (const r of feeRows) {
    let p = feeMap.get(r.product_code);
    if (!p) { p = { code: r.product_code, name: r.display_name, kind: r.product_kind, applyBy: r.apply_by, chartNote: r.chart_note, prices: {} }; feeMap.set(r.product_code, p); }
    p.prices[r.audience_code] = r.price_cents;
  }

  // Per-district opportunities (as home HD), joined to instrument/class + windows/restrictions.
  const oppRows = (await query<{
    region_id: number; district_code: string; district_name: string | null; geography_code: string;
    instr_code: string; instrument_name: string; species_code: string; legal_animal: string;
    quota_current: number | null; quota_unlimited: number; quota_min: number | null; quota_max: number | null;
    apply_by: string | null; otc_from: string | null; split_seq: number; validity_note: string | null;
    windows: { season_type: string; raw_range: string | null }[]; restrictions: { restr_code: string }[];
  }>(
    `SELECT d.region_id, d.district_code, d.district_name, d.geography_code,
            li.instr_code, li.display_name AS instrument_name, li.species_code, lac.display_label AS legal_animal,
            li.quota_current, li.quota_unlimited, li.quota_min, li.quota_max,
            to_char(li.apply_by,'FMMon DD') AS apply_by, to_char(li.otc_from,'FMMon DD') AS otc_from,
            o.split_seq, o.validity_note,
            COALESCE((SELECT json_agg(json_build_object('season_type',sw.season_type_code,'raw_range',sw.raw_range) ORDER BY sw.window_seq)
                      FROM regs.season_window sw WHERE sw.opportunity_id=o.opportunity_id),'[]') AS windows,
            COALESCE((SELECT json_agg(json_build_object('restr_code',r.restr_code) ORDER BY r.restr_seq)
                      FROM regs.opp_restriction r WHERE r.opportunity_id=o.opportunity_id),'[]') AS restrictions
     FROM regs.opportunity o
     JOIN regs.district d ON d.district_id=o.home_district_id
     JOIN regs.license_instrument li ON li.instrument_id=o.instrument_id
     JOIN regs.legal_animal_class lac ON lac.animal_class_id=o.animal_class_id
     WHERE o.season_year=$1 AND o.record_status <> 'ARCHIVED'
     ORDER BY d.region_id, d.district_code, li.species_code, li.instr_type_code, li.instr_code, o.split_seq`, [seasonYear],
  )).rows;

  const notesRows = (await query<{ district_code: string; note_text: string }>(
    `SELECT d.district_code, dn.note_text FROM regs.district_note dn JOIN regs.district d ON d.district_id=dn.district_id
     WHERE dn.season_year=$1 AND dn.record_status <> 'ARCHIVED' ORDER BY d.district_code, dn.note_seq`, [seasonYear],
  )).rows;
  const notesByDistrict = new Map<string, string[]>();
  for (const n of notesRows) { const l = notesByDistrict.get(n.district_code) ?? []; l.push(n.note_text); notesByDistrict.set(n.district_code, l); }

  const regionMap = new Map<number, BookRegion>();
  const districtMap = new Map<string, BookDistrict>();
  for (const r of oppRows) {
    let region = regionMap.get(r.region_id);
    if (!region) { region = { regionId: r.region_id, regionName: `Region ${r.region_id}`, districts: [] }; regionMap.set(r.region_id, region); }
    const dkey = `${r.region_id}:${r.district_code}`;
    let district = districtMap.get(dkey);
    if (!district) {
      district = { districtCode: r.district_code, districtName: r.district_name, geography: r.geography_code, notes: notesByDistrict.get(r.district_code) ?? [], opps: [] };
      districtMap.set(dkey, district); region.districts.push(district);
    }
    const windows: Record<string, string> = {};
    for (const w of r.windows) if (w.raw_range) windows[w.season_type] = windows[w.season_type] ? `${windows[w.season_type]}, ${w.raw_range}` : w.raw_range;
    district.opps.push({
      instrCode: r.instr_code, instrumentName: r.instrument_name, species: r.species_code, legalAnimal: r.legal_animal,
      quota: r.quota_unlimited ? "UNL" : (r.quota_current != null ? String(r.quota_current) : "-"),
      applyBy: r.otc_from ? `OTC: ${r.otc_from}` : (r.apply_by ?? "-"),
      windows, splitSeq: r.split_seq,
      restrictions: [r.validity_note ?? "", ...r.restrictions.map((x) => x.restr_code).filter((c) => c !== "OTHER")].filter(Boolean).join(" · "),
    });
  }

  const rareas = (await query<{ area_type: string; area_name: string; legal_desc: string | null; districts: string[] }>(
    `SELECT ra.area_type, ra.area_name, ra.legal_desc,
            COALESCE((SELECT json_agg(d.district_code ORDER BY d.district_code) FROM regs.district_rarea dr JOIN regs.district d ON d.district_id=dr.district_id WHERE dr.rarea_id=ra.rarea_id),'[]') AS districts
     FROM regs.restricted_area ra WHERE ra.season_year=$1 ORDER BY ra.area_name`, [seasonYear],
  )).rows.map((r) => ({ areaType: r.area_type, areaName: r.area_name, legalDesc: r.legal_desc, districts: r.districts }));

  // Important dates (book p.11) — kept in date_kind + sort_order order.
  const importantDates = (await query<{ date_kind: string; species_scope: string | null; label: string; starts_on: string | null; ends_on: string | null; note: string | null }>(
    `SELECT date_kind, species_scope, label, to_char(starts_on,'FMMon FMDD') AS starts_on, to_char(ends_on,'FMMon FMDD') AS ends_on, note
     FROM regs.important_date WHERE season_year=$1 AND record_status <> 'ARCHIVED' ORDER BY sort_order, date_code`, [seasonYear],
  )).rows.map((r) => ({ dateKind: r.date_kind, speciesScope: r.species_scope, label: r.label, startsOn: r.starts_on, endsOn: r.ends_on, note: r.note }));

  // Contacts (book pp.143-144) — grouped by contact_kind.
  const contacts = (await query<{ contact_kind: string; name: string; org: string | null; address: string | null; city: string | null; phone: string | null; phone2: string | null; email: string | null; url: string | null; note: string | null }>(
    `SELECT contact_kind, name, org, address, city, phone, phone2, email, url, note
     FROM regs.contact WHERE season_year=$1 AND record_status <> 'ARCHIVED' ORDER BY sort_order, contact_code`, [seasonYear],
  )).rows.map((r) => ({ kind: r.contact_kind, name: r.name, org: r.org, address: r.address, city: r.city, phone: r.phone, phone2: r.phone2, email: r.email, url: r.url, note: r.note }));

  // Sunrise-sunset (book p.151) — 4 zones with counties + the full time grid.
  const ssZones = (await query<{ zone_no: number; zone_name: string; counties: string[] }>(
    `SELECT z.zone_no, z.zone_name,
            COALESCE((SELECT json_agg(c.county_name ORDER BY c.county_name) FROM regs.ss_zone_county c WHERE c.ss_zone_id=z.ss_zone_id),'[]') AS counties
     FROM regs.ss_zone z WHERE z.season_year=$1 ORDER BY z.zone_no`, [seasonYear],
  )).rows;
  const ssTimes = (await query<{ zone_no: number; month_no: number; day_no: number; rise_min: number; set_min: number }>(
    `SELECT z.zone_no, t.month_no, t.day_no, t.rise_min, t.set_min
     FROM regs.ss_time t JOIN regs.ss_zone z ON z.ss_zone_id=t.ss_zone_id
     WHERE z.season_year=$1 ORDER BY z.zone_no, t.month_no, t.day_no`, [seasonYear],
  )).rows;
  const sunrise: BookSunriseZone[] = ssZones.map((z) => ({
    zoneNo: z.zone_no, zoneName: z.zone_name, counties: z.counties,
    times: ssTimes.filter((t) => t.zone_no === z.zone_no).map((t) => ({ month: t.month_no, day: t.day_no, rise: t.rise_min, set: t.set_min })),
  }));

  // Map/figure assets (book plates) — placeholder CMS today; the renderer draws captioned slots.
  const assets = (await query<{ asset_kind: string; title: string; caption: string | null; cms_doc_id: string; region_id: number | null; geography_code: string | null }>(
    `SELECT a.asset_kind, a.title, a.caption, a.cms_doc_id, ra.region_id, ra.geography_code
     FROM regs.cms_asset a
     LEFT JOIN regs.region_asset ra ON ra.asset_id=a.asset_id
     WHERE a.season_year=$1 OR a.season_year IS NULL
     ORDER BY a.asset_kind, ra.geography_code, ra.region_id, a.title`, [seasonYear],
  )).rows.map((r) => ({ kind: r.asset_kind, title: r.title, caption: r.caption, regionId: r.region_id, geography: r.geography_code, cmsDocId: r.cms_doc_id }));

  return {
    seasonYear, content, fees: [...feeMap.values()],
    regions: [...regionMap.values()].sort((a, b) => a.regionId - b.regionId),
    restrictedAreas: rareas, importantDates, contacts, sunrise, assets,
  };
}
