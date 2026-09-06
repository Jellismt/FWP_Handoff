/**
 * @file loadImportantDates.ts
 * @module engage-mt/server/etl
 * @description Hand-curated seed of the "Important Dates" tables (2026 DEA book printed p.11):
 *              2026 Season Dates, Application/Purchase Deadlines, and Drawing Results, plus the
 *              scattered purchase windows named elsewhere in the book (OTC B-license June 15,
 *              bonus-point July 1-Sept 30, preference-point July 1-Dec 31, game-damage roster
 *              June 15-July 15, shed-hunting May 15). Transcribed verbatim from the printed
 *              book. Drawing-result rows carry approximate month labels (not exact dates), so
 *              their date columns are null and the timing lives in `note`. Idempotent per
 *              (season_year, date_code). Loads DRAFT.
 *              Usage: `tsx src/etl/loadImportantDates.ts [year]` (default 2026).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { withTransaction, closePool, query } from "../db/pool.js";

// code, kind, species_scope, label, starts_on|null, ends_on|null, note|null, sort
type Row = [string, string, string | null, string, string | null, string | null, string | null, number];

const ROWS: Row[] = [
  // ── 2026 Season Dates ──
  ["season-antelope-900", "SEASON", "Antelope", "Antelope 900 series", "2026-08-15", "2026-11-08", null, 10],
  ["season-antelope-archery", "SEASON", "Antelope", "Antelope archery", "2026-09-05", "2026-10-09", null, 11],
  ["season-antelope-general", "SEASON", "Antelope", "Antelope general", "2026-10-10", "2026-11-08", null, 12],
  ["season-caribou", "SEASON", "Caribou", "Caribou", null, null, "No Season", 13],
  ["season-de-archery", "SEASON", "Deer & Elk", "Deer & Elk archery", "2026-09-05", "2026-10-18", null, 20],
  ["season-de-youth-2day", "SEASON", "Deer", "Deer & Elk youth two-day hunt (deer only)", "2026-10-15", "2026-10-16", null, 21],
  ["season-de-general", "SEASON", "Deer & Elk", "Deer & Elk general", "2026-10-24", "2026-11-29", null, 22],
  ["season-shoulder", "SEASON", "Elk", "Shoulder seasons", null, null, "Check the individual hunting district regulations.", 23],
  ["season-backcountry-archery", "SEASON", "Deer & Elk", "Backcountry archery (HDs 150, 280, 316)", "2026-09-05", "2026-09-14", "HD 316 does not have an Archery Only Season.", 24],
  ["season-backcountry-general", "SEASON", "Deer & Elk", "Backcountry general (HDs 150, 280, 316)", "2026-09-15", "2026-11-29", null, 25],
  // ── 2026 Application/Purchase Deadlines ──
  ["deadline-antelope", "DEADLINE", "Antelope", "Antelope (apply by)", "2026-06-01", null, null, 40],
  ["deadline-de-permits", "DEADLINE", "Deer & Elk", "Deer & Elk permits (apply by)", "2026-04-01", null, null, 41],
  ["deadline-de-b", "DEADLINE", "Deer & Elk", "Deer & Elk B licenses (apply by)", "2026-06-01", null, null, 42],
  ["deadline-supertag", "DEADLINE", "All", "Super Tags — Antelope, Bighorn Sheep, Bison, Deer, Elk, Moose, Mountain Goat, Mountain Lion (apply by)", "2026-06-30", null, null, 43],
  // ── Drawing Results (approximate month labels — dates in note) ──
  ["draw-nr-combo", "DRAWING_RESULT", "All", "Nonresident Combination", null, null, "Drawing results Mid-April; refunds mailed Early May.", 60],
  ["draw-de-permits", "DRAWING_RESULT", "Deer & Elk", "Deer & Elk Permits", null, null, "Drawing results Mid-April; refunds mailed Early May.", 61],
  ["draw-supertags", "DRAWING_RESULT", "All", "SuperTags — Antelope, Bighorn Sheep, Bison, Deer, Elk, Moose, Mountain Goat, Mountain Lion", null, null, "Drawing results after July 8; refunds N/A.", 62],
  ["draw-antelope-archery-deb", "DRAWING_RESULT", "All", "Antelope Archery 900-20, Deer B, Elk B, Licenses", null, null, "Drawing results Mid-June; refunds mailed End of Aug.", 63],
  ["draw-antelope", "DRAWING_RESULT", "Antelope", "Antelope & Antelope B", null, null, "Drawing results Early Aug.; refunds mailed Early Sep.", 64],
  // ── Purchase windows named elsewhere in the book ──
  ["window-otc-b", "PURCHASE_WINDOW", "Deer & Elk", "Over-the-counter Deer B & Elk B license purchase begins", "2026-06-15", null, "OTC B licenses.", 80],
  ["window-bonus-point", "PURCHASE_WINDOW", "All", "Bonus point purchase window", "2026-07-01", "2026-09-30", "For hunters not applying for a license/permit that year.", 81],
  ["window-preference-point", "PURCHASE_WINDOW", "All", "Nonresident combination preference-point purchase window", "2026-07-01", "2026-12-31", null, 82],
  ["window-game-damage-roster", "PURCHASE_WINDOW", "All", "Game Damage Hunt Roster sign-up", "2026-06-15", "2026-07-15", "On the FWP website through MyFWP.", 83],
  ["window-shed-hunting", "PURCHASE_WINDOW", "All", "Shed hunting on WMAs opens", "2026-05-15", null, "Nonresident access restricted for the first 7 days.", 84],
];

export async function loadImportantDates(seasonYear = Number(process.argv[2]) || 2026): Promise<void> {
  const sd = await query<{ v: string }>(`SELECT source_doc_id::text AS v FROM regs.source_document WHERE season_year=$1 LIMIT 1`, [seasonYear]);
  const sourceDocId = sd.rows[0]?.v ?? null;

  await withTransaction("etl-important-dates", async (c) => {
    for (const [code, kind, scope, label, starts, ends, note, sort] of ROWS) {
      const existing = await c.query<{ id: string }>(
        `SELECT important_date_id AS id FROM regs.important_date WHERE season_year=$1 AND date_code=$2`, [seasonYear, code]);
      if (existing.rows[0]) {
        await c.query(
          `UPDATE regs.important_date SET date_kind=$3, species_scope=$4, label=$5, starts_on=$6, ends_on=$7, note=$8, sort_order=$9, updated_by='etl'
            WHERE season_year=$1 AND date_code=$2`,
          [seasonYear, code, kind, scope, label, starts, ends, note, sort]);
      } else {
        await c.query(
          `INSERT INTO regs.important_date (season_year, date_code, date_kind, species_scope, label, starts_on, ends_on, note, sort_order, updated_by, source_doc_id, source_page)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'etl',$10,11)`,
          [seasonYear, code, kind, scope, label, starts, ends, note, sort, sourceDocId]);
      }
    }
  });
  const n = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.important_date WHERE season_year=$1`, [seasonYear]);
  console.log(`Important dates for ${seasonYear}: ${n.rows[0]!.n} entries (DRAFT).`);
}

const isMain = process.argv[1]?.endsWith("loadImportantDates.ts") || process.argv[1]?.endsWith("loadImportantDates.js");
if (isMain) {
  loadImportantDates().then(() => closePool()).then(() => process.exit(0)).catch((e) => { console.error(e); void closePool().finally(() => process.exit(1)); });
}
