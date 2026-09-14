/**
 * @file loadMultiDistrict.ts
 * @module engage-mt/server/etl
 * @description Seeds MULTI hunt areas from the 2026 DEA book's "Reference Table for
 *              Licenses or Permits that are Valid in Multiple Districts" (pp.126-127) —
 *              the Deer B, Elk Permit, and Elk B licenses whose validity spans several
 *              hunting districts. Each row becomes a `hunt_area` (area_kind='MULTI') whose
 *              `definition_text` is the book's plain-English validity statement, with
 *              `hunt_area_member` rows linking to the explicit HDs (and, for "all Region N
 *              HDs" rows, every HD district in that region less any stated exceptions).
 *              area_code is prefixed by license type (DB/EP/EB) so it can't collide with a
 *              per-district area or across categories. Idempotent per (season_year,
 *              area_code). Loads DRAFT.
 *              Usage: `tsx src/etl/loadMultiDistrict.ts [year]` (default 2026).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { withTransaction, closePool, query } from "../db/pool.js";

// typeCode (DB=Deer B, EP=Elk Permit, EB=Elk B), license/permit number, apply-by, valid-in description
type Multi = [string, string, string, string];

const MULTI: Multi[] = [
  // ── Deer B Licenses ──
  ["DB", "003-00", "OTC: June 15", "Valid in all R3 HDs. Restrictions may apply in some districts, see each HD for more information."],
  ["DB", "004-00", "OTC: June 15", "Valid in all R4 HDs except HD 455."],
  ["DB", "004-01", "June 1", "Valid in all R4 HDs except HD 455."],
  ["DB", "005-00", "June 1", "Valid in all R5 HDs."],
  ["DB", "006-00", "OTC: June 15", "Valid in all R6 HDs."],
  ["DB", "007-00", "June 1", "Valid in all R7 HDs."],
  ["DB", "007-03", "June 1", "Valid in all R7 HDs."],
  ["DB", "199-20", "June 1", "Only valid in the Libby CWD Management Zones in HDs 100, 103, & 104."],
  ["DB", "260-01", "OTC: June 15", "Valid in HDs 201, 204, 240, 260, 261, 262, & 270. ArchEquip Only."],
  ["DB", "299-00", "OTC: June 15", "Valid in HDs 204, 240, 261, 270. Restrictions apply, see each HD for more information."],
  ["DB", "395-01", "June 1", "Valid in HDs 380 & 391. Restrictions apply, see each HD for more information."],
  ["DB", "397-00", "OTC: June 15", "Valid in HDs 314 & 317."],
  ["DB", "398-00", "OTC: June 15", "Valid in HDs 304, 309, 311, & 312."],
  ["DB", "399-00", "OTC: June 15", "Valid in HDs 302, 303, 320, 322, 323, 324, 329, 331, 340, & 360."],
  // ── Elk Permits ──
  ["EP", "411-20", "April 1", "Valid in HDs 411 & 535."],
  ["EP", "411-21", "April 1", "Valid in HDs 411 & 412."],
  ["EP", "417-21", "April 1", "Valid in HDs 417 & 426."],
  ["EP", "590-20", "April 1", "Valid in HDs 590 & 701. Restrictions apply, see each HD for more information."],
  ["EP", "595-21", "April 1", "Valid in HDs 502, 535, 555, 590 & 701. Restrictions apply, see each HD for more information."],
  ["EP", "620-20", "April 1", "Valid in HDs 620, 621, & 622. Restrictions apply, see each HD for more information."],
  ["EP", "620-21", "April 1", "Valid in HDs 620, 621, & 622."],
  ["EP", "799-20", "April 1", "Valid in HDs 702, 704, & 705."],
  ["EP", "799-21", "April 1", "Valid in HDs 702, 704, & 705."],
  // ── Elk B Licenses ──
  ["EB", "004-00", "OTC: June 15", "Valid in all R4 HDs except HDs 410 & 455. Restrictions may apply in some districts, see each HD for more information."],
  ["EB", "005-00", "June 1", "Valid in all Region 5 HDs except 565. Restrictions may apply in some districts, see each HD for more information."],
  ["EB", "007-00", "June 1", "Valid in all Region 7 HDs."],
  ["EB", "201-01", "June 1", "Valid in HDs 201 & 260. Restrictions apply, see each HD for more information."],
  ["EB", "210-03", "June 1", "Valid on private lands in HDs 211, 212, 216 and south portion of 210 (Rattling Gulch – Henderson Creek)."],
  ["EB", "262-01", "OTC: June 15", "Valid on private lands in HDs 204, 261, 262, and a portion of 270. Restrictions apply, see each HD for more info."],
  ["EB", "290-01", "June 1", "Valid in HDs 290 & 298. Restrictions apply, see each HD for more information."],
  ["EB", "317-00", "June 1", "Valid in HDs 313 & 317. Restrictions apply, see each HD for more information."],
  ["EB", "394-00", "June 1", "Valid in HDs 318 & 335. Restrictions apply, see each HD for more information."],
  ["EB", "396-00", "June 1", "Valid in HDs 339 & 343. Restrictions apply, see each HD for more information."],
  ["EB", "397-00", "OTC: June 15", "Valid in HDs 301, 309, 311, 312, 314, 315, portion of 380, 390, 391, & 393. Restrictions apply, see each HD for more information."],
  ["EB", "399-00", "June 1", "Valid in HDs 302, 303, 323, & 329."],
  ["EB", "411-00", "June 1", "Valid in HDs 411 & 535."],
  ["EB", "448-00", "June 1", "Valid in HDs 420 & 448."],
  ["EB", "621-01", "June 1", "Valid in HDs 620 & 621."],
  ["EB", "622-00", "June 1", "Valid in HDs 620 & 622."],
  ["EB", "698-00", "June 1", "Valid in HDs 620, 621, & 622. Restrictions apply, see each HD for more information."],
  ["EB", "699-01", "June 1", "Valid in HDs 620, 621, 622, 630, & 690. Restrictions apply, see each HD for more information."],
  ["EB", "799-00", "June 1", "Valid in HDs 702, 704, & 705."],
];

/** All 3-digit HD numbers referenced explicitly in a validity description. */
const explicitHds = (desc: string): string[] => {
  const out = new Set<string>();
  // Grab every 3-digit token that looks like an HD (100-799).
  for (const m of desc.matchAll(/\b([1-7]\d\d)\b/g)) out.add(m[1]!);
  return [...out];
};

/** Region number if the row says "all R<N>" / "all Region <N> HDs", else null. */
const allRegion = (desc: string): number | null => {
  const m = desc.match(/all (?:R|Region )\s*([1-7])\b/i);
  return m ? Number(m[1]) : null;
};

/** HDs to exclude ("except HD 455", "except HDs 410 & 455", "except 565"). */
const exceptHds = (desc: string): string[] => {
  const m = desc.match(/except (?:HDs?\s*)?([\d,&\s]+)/i);
  if (!m) return [];
  return [...m[1]!.matchAll(/\b([1-7]\d\d)\b/g)].map((x) => x[1]!);
};

export async function loadMultiDistrict(seasonYear = Number(process.argv[2]) || 2026): Promise<void> {
  // Map HD code -> district_id, and region -> HD codes, once.
  const districts = await query<{ code: string; id: string; region: number | null }>(
    `SELECT district_code AS code, district_id::text AS id, region_id AS region
       FROM regs.district WHERE geography_code='HD'`, []);
  const idByCode = new Map(districts.rows.map((r) => [r.code, r.id]));
  const codesByRegion = new Map<number, string[]>();
  for (const r of districts.rows) {
    if (r.region == null) continue;
    const arr = codesByRegion.get(r.region) ?? [];
    arr.push(r.code);
    codesByRegion.set(r.region, arr);
  }

  let linked = 0;
  await withTransaction("etl-multi-district", async (c) => {
    for (const [typeCode, num, _applyBy, desc] of MULTI) {
      const areaCode = `${typeCode}-${num}`;
      // Resolve the set of member HD codes.
      let codes: string[];
      const region = allRegion(desc);
      if (region != null) {
        const excl = new Set(exceptHds(desc));
        codes = (codesByRegion.get(region) ?? []).filter((code) => !excl.has(code));
      } else {
        codes = explicitHds(desc);
      }
      const memberIds = codes.map((code) => idByCode.get(code)).filter((v): v is string => !!v);

      // Upsert the MULTI hunt area.
      const existing = await c.query<{ id: string }>(
        `SELECT hunt_area_id::text AS id FROM regs.hunt_area WHERE season_year=$1 AND area_code=$2`, [seasonYear, areaCode]);
      let haId = existing.rows[0]?.id;
      if (haId) {
        await c.query(`UPDATE regs.hunt_area SET area_kind='MULTI', definition_text=$3 WHERE hunt_area_id=$1 AND season_year=$2`,
          [haId, seasonYear, desc]);
        await c.query(`DELETE FROM regs.hunt_area_member WHERE hunt_area_id=$1`, [haId]);
      } else {
        const r = await c.query<{ id: string }>(
          `INSERT INTO regs.hunt_area (season_year, area_code, area_kind, definition_text)
           VALUES ($1,$2,'MULTI',$3) RETURNING hunt_area_id::text AS id`, [seasonYear, areaCode, desc]);
        haId = r.rows[0]!.id;
      }
      let seq = 1;
      for (const districtId of memberIds) {
        await c.query(`INSERT INTO regs.hunt_area_member (hunt_area_id, member_seq, district_id) VALUES ($1,$2,$3)`,
          [haId, seq++, districtId]);
        linked++;
      }
    }
  });
  const n = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.hunt_area WHERE season_year=$1 AND area_kind='MULTI'`, [seasonYear]);
  console.log(`Multi-district for ${seasonYear}: ${n.rows[0]!.n} MULTI hunt areas, ${linked} member links (DRAFT).`);
}

const isMain = process.argv[1]?.endsWith("loadMultiDistrict.ts") || process.argv[1]?.endsWith("loadMultiDistrict.js");
if (isMain) {
  loadMultiDistrict().then(() => closePool()).then(() => process.exit(0)).catch((e) => { console.error(e); void closePool().finally(() => process.exit(1)); });
}
