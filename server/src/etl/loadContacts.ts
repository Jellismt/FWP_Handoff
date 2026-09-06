/**
 * @file loadContacts.ts
 * @module engage-mt/server/etl
 * @description Hand-curated seed of the book's Contact List (2026 DEA book printed pp.143-144):
 *              FWP State HQ + hotlines, the seven Regional HQs and their area/field offices,
 *              non-FWP Montana state agencies, federal agencies, and tribal governments, plus
 *              the MonTECH assistive-technology contact (p.20) and the bear-encounter reporting
 *              line (p.47). Individual bear-management-specialist names are intentionally NOT
 *              transcribed — the low-resolution web PDF does not render the proper-name spellings
 *              reliably, and a wrong name is worse than a pointer to the reporting line + p.47.
 *              Transcribed verbatim; idempotent per (season_year, contact_code). Loads DRAFT.
 *              Usage: `tsx src/etl/loadContacts.ts [year]` (default 2026).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { withTransaction, closePool, query } from "../db/pool.js";

// code, kind, name, org|null, address|null, city|null, phone|null, phone2|null, email|null, url|null, region_id|null, note|null, sort
type Row = [string, string, string, string | null, string | null, string | null, string | null, string | null, string | null, string | null, number | null, string | null, number];

const ROWS: Row[] = [
  // ── State HQ ──
  ["state-hq", "STATE_HQ", "Montana Fish, Wildlife & Parks State Headquarters", "Montana FWP", "1420 East 6th Avenue, PO Box 200701", "Helena, MT 59620-0701", "406-444-2535", null, null, "https://fwp.mt.gov", null, null, 1],
  // ── Hotlines / functional numbers ──
  ["hotline-harvest", "HOTLINE", "Harvest Reporting", "Montana FWP", null, null, "1-877-397-9453", "406-444-0356", null, null, null, "1-877-FWP-WILD", 10],
  ["hotline-quota", "HOTLINE", "Quota Status", "Montana FWP", null, null, "1-800-385-7826", "406-444-1989", null, null, null, null, 11],
  ["hotline-hunter-ed", "HOTLINE", "Hunter Education", "Montana FWP", null, null, "406-444-9948", null, null, null, null, null, 12],
  ["hotline-wildlife", "HOTLINE", "Wildlife", "Montana FWP", null, null, "406-444-2612", null, null, null, null, null, 13],
  ["hotline-enforcement", "HOTLINE", "Enforcement", "Montana FWP", null, null, "406-444-2452", null, null, null, null, null, 14],
  ["hotline-state-parks", "HOTLINE", "Montana State Parks", "Montana FWP", null, null, "406-444-3750", null, null, null, null, null, 15],
  ["hotline-drawings", "HOTLINE", "Drawings", "Montana FWP", null, null, "406-444-2950", null, null, null, null, null, 16],
  ["hotline-licenses", "HOTLINE", "Licenses", "Montana FWP", null, null, "406-444-2950", null, null, null, null, null, 17],
  ["hotline-hearing", "HOTLINE", "Hearing Impaired (Montana Relay)", "Montana FWP", null, null, "7-1-1", "1-800-253-4091", null, null, null, null, 18],
  ["hotline-tipmont", "HOTLINE", "Report a violation / bear encounter (TIP-MONT)", "Montana FWP", null, null, "1-800-847-6668", null, null, "https://tipmont.mt.gov", null, "1-800-TIP-MONT. Report grizzly-bear encounters showing aggressive/defensive behavior; regional bear-management specialists are listed on the Bear Aware page (p.47).", 19],
  // ── Regional HQs + area/field offices ──
  ["region-1", "REGIONAL_HQ", "Region 1 Headquarters", "Montana FWP", "490 N Meridian Rd", "Kalispell, MT 59901", "406-752-5501", null, null, null, 1, null, 30],
  ["region-1-libby", "FIELD_OFFICE", "Libby Field Office", "Montana FWP", "385 Fish Hatchery Rd", "Libby, MT 59923", "406-293-4161", null, null, null, 1, null, 31],
  ["region-2", "REGIONAL_HQ", "Region 2 Headquarters", "Montana FWP", "3201 Spurgin Rd", "Missoula, MT 59804", "406-542-5500", null, null, null, 2, null, 32],
  ["region-3", "REGIONAL_HQ", "Region 3 Headquarters", "Montana FWP", "1400 South 19th Ave", "Bozeman, MT 59718", "406-577-7900", null, null, null, 3, null, 33],
  ["region-3-haro", "FIELD_OFFICE", "Helena Area Resource Office (HARO)", "Montana FWP", "930 Custer Ave W", "Helena, MT 59620", "406-495-3260", null, null, null, 3, null, 34],
  ["region-3-baro", "FIELD_OFFICE", "Butte Area Resource Office (BARO)", "Montana FWP", "1820 Meadowlark Ln", "Butte, MT 59701", "406-494-1953", null, null, null, 3, null, 35],
  ["region-4", "REGIONAL_HQ", "Region 4 Headquarters", "Montana FWP", "4600 Giant Springs Rd", "Great Falls, MT 59405", "406-454-5840", null, null, null, 4, null, 36],
  ["region-4-laro", "FIELD_OFFICE", "Lewistown Area Resource Office (LARO)", "Montana FWP", "190 Terminal Dr, PO Box 938", "Lewistown, MT 59457", "406-538-4658", null, null, null, 4, null, 37],
  ["region-5", "REGIONAL_HQ", "Region 5 Headquarters", "Montana FWP", "2300 Lake Elmo Dr", "Billings, MT 59105", "406-247-2940", null, null, null, 5, null, 38],
  ["region-6", "REGIONAL_HQ", "Region 6 Headquarters", "Montana FWP", "1 Airport Rd", "Glasgow, MT 59230", "406-228-3700", null, null, null, 6, null, 39],
  ["region-6-hvaro", "FIELD_OFFICE", "Havre Area Resource Office (HvARO)", "Montana FWP", "2165 Hwy 2 East", "Havre, MT 59501", "406-265-6177", null, null, null, 6, null, 40],
  ["region-7", "REGIONAL_HQ", "Region 7 Headquarters", "Montana FWP", "352 I-94 Business Loop, PO Box 1630", "Miles City, MT 59301", "406-234-0900", null, null, null, 7, null, 41],
  // ── Non-FWP Montana state agencies ──
  ["state-agriculture", "STATE_AGENCY", "Montana Department of Agriculture", null, null, null, "406-444-3144", null, null, null, null, null, 60],
  ["state-outfitters", "STATE_AGENCY", "Guides & Outfitters (Board of Outfitters)", null, null, null, "406-841-2300", null, null, null, null, null, 61],
  ["state-livestock", "STATE_AGENCY", "Montana Department of Livestock", null, null, null, "406-444-7323", null, null, null, null, null, 62],
  ["state-dnrc", "STATE_AGENCY", "State Lands (DNRC)", null, null, null, "406-444-2074", null, null, null, null, null, 63],
  ["state-tourism", "STATE_AGENCY", "Montana Office of Tourism", null, null, null, "406-841-2870", null, null, null, null, null, 64],
  // ── Federal agencies ──
  ["fed-usdi", "FEDERAL", "US Department of the Interior (USDI)", null, null, null, "202-208-3100", null, null, null, null, null, 70],
  ["fed-usfws", "FEDERAL", "USDI Fish & Wildlife Service", null, null, null, "406-449-5225", null, null, null, null, null, 71],
  ["fed-usfs", "FEDERAL", "USDA Forest Service", null, null, null, "406-329-3511", null, null, null, null, null, 72],
  ["fed-blm", "FEDERAL", "Bureau of Land Management", null, null, null, "406-896-5000", null, null, null, null, null, 73],
  ["fed-nws", "FEDERAL", "National Weather Service (Missoula)", null, null, null, "406-329-4840", null, null, null, null, null, 74],
  // ── Tribal governments ──
  ["tribal-blackfeet", "TRIBAL", "Blackfeet Reservation", null, null, null, "406-338-7276", null, null, null, null, null, 80],
  ["tribal-crow", "TRIBAL", "Crow Reservation", null, null, null, "406-638-2179", null, null, null, null, null, 81],
  ["tribal-flathead", "TRIBAL", "Flathead Reservation", null, null, null, "406-883-2888", null, null, null, null, "ext 7200", 82],
  ["tribal-fort-belknap", "TRIBAL", "Fort Belknap", null, null, null, "406-353-2205", null, null, null, null, null, 83],
  ["tribal-fort-peck", "TRIBAL", "Fort Peck Reservation", null, null, null, "406-768-5305", null, null, null, null, null, 84],
  ["tribal-northern-cheyenne", "TRIBAL", "Northern Cheyenne Reservation", null, null, null, "406-477-6526", null, null, null, null, null, 85],
  ["tribal-rocky-boys", "TRIBAL", "Rocky Boy's Reservation", null, null, null, "406-395-4207", null, null, null, null, null, 86],
  // ── Assistive technology (p.20) ──
  ["montech", "OTHER", "MonTECH — assistive technology & adaptive equipment", "University of Montana Rural Institute", "29 McGill Hall", "Missoula, MT 59812", "406-243-5751", null, null, "https://montech.ruralinstitute.umt.edu", null, "For hunters with a disability who need adaptive equipment to participate in outdoor recreation.", 90],
];

export async function loadContacts(seasonYear = Number(process.argv[2]) || 2026): Promise<void> {
  const sd = await query<{ v: string }>(`SELECT source_doc_id::text AS v FROM regs.source_document WHERE season_year=$1 LIMIT 1`, [seasonYear]);
  const sourceDocId = sd.rows[0]?.v ?? null;

  await withTransaction("etl-contacts", async (c) => {
    for (const [code, kind, name, org, address, city, phone, phone2, email, url, region, note, sort] of ROWS) {
      const existing = await c.query<{ id: string }>(`SELECT contact_id AS id FROM regs.contact WHERE season_year=$1 AND contact_code=$2`, [seasonYear, code]);
      if (existing.rows[0]) {
        await c.query(
          `UPDATE regs.contact SET contact_kind=$3, name=$4, org=$5, address=$6, city=$7, phone=$8, phone2=$9, email=$10, url=$11, region_id=$12, note=$13, sort_order=$14, updated_by='etl'
            WHERE season_year=$1 AND contact_code=$2`,
          [seasonYear, code, kind, name, org, address, city, phone, phone2, email, url, region, note, sort]);
      } else {
        await c.query(
          `INSERT INTO regs.contact (season_year, contact_code, contact_kind, name, org, address, city, phone, phone2, email, url, region_id, note, sort_order, updated_by, source_doc_id, source_page)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'etl',$15,144)`,
          [seasonYear, code, kind, name, org, address, city, phone, phone2, email, url, region, note, sort, sourceDocId]);
      }
    }
  });
  const n = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.contact WHERE season_year=$1`, [seasonYear]);
  console.log(`Contacts for ${seasonYear}: ${n.rows[0]!.n} entries (DRAFT).`);
}

const isMain = process.argv[1]?.endsWith("loadContacts.ts") || process.argv[1]?.endsWith("loadContacts.js");
if (isMain) {
  loadContacts().then(() => closePool()).then(() => process.exit(0)).catch((e) => { console.error(e); void closePool().finally(() => process.exit(1)); });
}
