/**
 * @file loadDeaJson.ts
 * @module engage-mt/server/etl
 * @description ETL seed the normalized schema from the existing flat DEA
 *              extraction (web/public/data/hunting-district-regulations.json, the 2026
 *              book). Lands every row in stg_dea_row, then promotes DEER + ELK rows to
 *              DRAFT normalized rows (districts, instruments, hunt areas, opportunities,
 *              windows, restrictions, notes). ANTELOPE + UNKNOWN rows are quarantined in
 * Staging for (antelope must key to its own geography). Prints a QA
 *              report. Re-runnable: clears DRAFT rows for the season first.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { PoolClient } from "pg";
import { withTransaction, closePool, query } from "../db/pool.js";
import {
  parseInstrument,
  resolveRange,
  classifyRestriction,
  classCodeFor,
  type DeaSpecies,
} from "./deaParse.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// Clean re-extraction of the deer/elk district tables (printed pp.48-123) via pdfplumber's
// cell-border table extraction — see scripts/extract-deer-elk.py. Replaces the original lossy
// flat extraction (garbled columns, dropped/split cells); every row now carries its license
// (carry-forward within each species block) with correct column mapping. Override with DEA_JSON.
const DEFAULT_JSON = join(HERE, "deer-elk-districts-2026.json");

/** Coerce the flat `quota` field (number | "UNL" | null) to structured columns. */
function parseQuota(raw: unknown): { current: number | null; unlimited: boolean } {
  if (raw == null) return { current: null, unlimited: false };
  if (typeof raw === "number" && Number.isInteger(raw)) return { current: raw, unlimited: false };
  if (typeof raw === "string" && /unl/i.test(raw)) return { current: null, unlimited: true };
  const n = Number(String(raw).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && String(raw).trim() !== "" ? { current: n, unlimited: false } : { current: null, unlimited: false };
}

interface DeaRow {
  hd: string;
  districtName: string | null;
  region: number | null;
  districtNotes?: string[] | null;
  species: string;
  license: string | null;
  opportunity: string | null;
  applyByDate: string | null;
  quota: number | string | null;
  quotaRange: string | null;
  earlySeasonDates: string | null;
  archeryDates: string | null;
  generalDates: string | null;
  heritageMuzzleloaderDates: string | null;
  lateSeasonDates: string | null;
  opportunitySpecific: string | null;
  rawRow: string | null;
}

const SEASON_COLS: [keyof DeaRow, string][] = [
  ["earlySeasonDates", "EARLY"],
  ["archeryDates", "ARCHERY"],
  ["generalDates", "GENERAL"],
  ["heritageMuzzleloaderDates", "HERITAGE_ML"],
  ["lateSeasonDates", "LATE"],
];

interface Caches {
  districtId: Map<string, string>;
  huntAreaId: Map<string, string>;
  classId: Map<string, string>;
  instrumentId: Map<string, string>;
  splitSeq: Map<string, number>;
}

/** Clip a value to a column length (ETL cleaning of extraction noise). */
function clip(s: string | null, n: number): string | null {
  if (s == null) return null;
  return s.length > n ? s.slice(0, n) : s;
}

async function scalar(client: PoolClient, sql: string, params: unknown[]): Promise<string | null> {
  const r = await client.query<{ v: string }>(sql, params);
  return r.rows[0]?.v ?? null;
}

async function ensureDistrict(
  client: PoolClient,
  c: Caches,
  seasonYear: number,
  code: string,
  region: number | null,
  name: string | null,
): Promise<string> {
  const key = `HD:${code}`;
  const cached = c.districtId.get(key);
  if (cached) return cached;
  let id = await scalar(
    client,
    `SELECT district_id::text AS v FROM regs.district WHERE geography_code = 'HD' AND district_code = $1`,
    [code],
  );
  if (!id) {
    id = await scalar(
      client,
      `INSERT INTO regs.district (geography_code, district_code, region_id, district_name, first_season)
       VALUES ('HD', $1, $2, $3, $4) RETURNING district_id::text AS v`,
      [code, region ?? 1, clip(name, 120), seasonYear],
    );
  }
  c.districtId.set(key, id!);
  return id!;
}

async function ensureHuntArea(
  client: PoolClient,
  c: Caches,
  seasonYear: number,
  districtId: string,
  code: string,
): Promise<string> {
  const areaCode = `HD-${code}`;
  const key = `${seasonYear}:${areaCode}`;
  const cached = c.huntAreaId.get(key);
  if (cached) return cached;
  let id = await scalar(
    client,
    `SELECT hunt_area_id::text AS v FROM regs.hunt_area WHERE season_year = $1 AND area_code = $2`,
    [seasonYear, areaCode],
  );
  if (!id) {
    id = await scalar(
      client,
      `INSERT INTO regs.hunt_area (season_year, area_code, area_kind, definition_text)
       VALUES ($1, $2, 'DISTRICT', $3) RETURNING hunt_area_id::text AS v`,
      [seasonYear, areaCode, `HD ${code}`],
    );
    await client.query(
      `INSERT INTO regs.hunt_area_member (hunt_area_id, member_seq, district_id) VALUES ($1, 1, $2)`,
      [id, districtId],
    );
  }
  c.huntAreaId.set(key, id!);
  return id!;
}

async function ensureClass(
  client: PoolClient,
  c: Caches,
  species: DeaSpecies,
  label: string,
): Promise<string> {
  const code = classCodeFor(label);
  const key = `${species}:${code}`;
  const cached = c.classId.get(key);
  if (cached) return cached;
  let id = await scalar(
    client,
    `SELECT animal_class_id::text AS v FROM regs.legal_animal_class WHERE species_code = $1 AND class_code = $2`,
    [species, code],
  );
  if (!id) {
    id = await scalar(
      client,
      `INSERT INTO regs.legal_animal_class (species_code, class_code, display_label)
       VALUES ($1, $2, $3) RETURNING animal_class_id::text AS v`,
      [species, code, clip(label, 120)],
    );
  }
  c.classId.set(key, id!);
  return id!;
}

async function ensureInstrument(
  client: PoolClient,
  c: Caches,
  seasonYear: number,
  sourceDocId: string,
  species: DeaSpecies,
  row: DeaRow,
): Promise<{ instrumentId: string; classLabel: string } | null> {
  // Continuation-row recovery: the PDF-table extraction emits the General License's extra
  // opportunity rows with an EMPTY license column, always ahead of the license-bearing row.
  // Every such row in the 2026 book carries a clean animal class (never a fragment) and
  // belongs to the General License — B-License/Permit blocks are single-row and never
  // produce continuation rows (verified: all 239 empty-license deer/elk rows inherit the
  // General License). Recover them rather than dropping ~239 real opportunities.
  const parsed = row.license
    ? parseInstrument(row.license, species)
    : row.opportunity
      ? ({
          instrTypeCode: "GENERAL",
          instrCode: `GEN-${species.toUpperCase()}`,
          displayName: `General ${species === "deer" ? "Deer" : "Elk"} License`,
          isDraw: false,
          trailingLabel: null,
        } satisfies ReturnType<typeof parseInstrument>)
      : null;
  if (!parsed) return null;
  const classLabel = row.opportunity ?? parsed.trailingLabel;
  if (!classLabel) return null;

  const key = `${seasonYear}:${parsed.instrCode}`;
  let id = c.instrumentId.get(key) ?? null;
  if (!id) {
    id = await scalar(
      client,
      `SELECT instrument_id::text AS v FROM regs.license_instrument WHERE season_year = $1 AND instr_code = $2`,
      [seasonYear, parsed.instrCode],
    );
  }
  const [qMin, qMax] = row.quotaRange
    ? row.quotaRange.split("-").map((x) => Number(x.replace(/[^\d]/g, "")))
    : [null, null];
  if (!id) {
    const q = parseQuota(row.quota);
    id = await scalar(
      client,
      `INSERT INTO regs.license_instrument
         (season_year, instr_type_code, species_code, instr_code, display_name, is_draw,
          apply_by, quota_current, quota_unlimited, quota_min, quota_max, updated_by, source_doc_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'etl',$12)
       RETURNING instrument_id::text AS v`,
      [
        seasonYear, parsed.instrTypeCode, species, parsed.instrCode, parsed.displayName,
        parsed.isDraw ? 1 : 0, null, q.current, q.unlimited ? 1 : 0,
        Number.isFinite(qMin) ? qMin : null, Number.isFinite(qMax) ? qMax : null, sourceDocId,
      ],
    );
  }
  c.instrumentId.set(key, id!);
  return { instrumentId: id!, classLabel };
}

async function promoteRow(
  client: PoolClient,
  c: Caches,
  seasonYear: number,
  sourceDocId: string,
  species: DeaSpecies,
  row: DeaRow,
): Promise<boolean> {
  const districtId = await ensureDistrict(client, c, seasonYear, row.hd, row.region, row.districtName);
  const huntAreaId = await ensureHuntArea(client, c, seasonYear, districtId, row.hd);
  const instr = await ensureInstrument(client, c, seasonYear, sourceDocId, species, row);
  if (!instr) return false;
  const classId = await ensureClass(client, c, species, instr.classLabel);

  const splitKey = `${instr.instrumentId}:${classId}:${huntAreaId}`;
  const nextSplit = (c.splitSeq.get(splitKey) ?? 0) + 1;
  c.splitSeq.set(splitKey, nextSplit);

  const oppId = await scalar(
    client,
    `INSERT INTO regs.opportunity
       (season_year, instrument_id, animal_class_id, hunt_area_id, split_seq, home_district_id,
        validity_note, updated_by, source_doc_id, raw_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'etl',$8,$9)
     RETURNING opportunity_id::text AS v`,
    [seasonYear, instr.instrumentId, classId, huntAreaId, nextSplit, districtId, row.opportunitySpecific, sourceDocId, row.rawRow],
  );

  // Windows.
  for (const [field, seasonType] of SEASON_COLS) {
    const raw = row[field] as string | null;
    if (!raw) continue;
    const resolved = resolveRange(raw, seasonYear);
    if (!resolved) continue;
    await client.query(
      `INSERT INTO regs.season_window (opportunity_id, season_type_code, window_seq, starts_on, ends_on, raw_range)
       VALUES ($1,$2,1,$3,$4,$5)`,
      [oppId, seasonType, resolved.starts_on, resolved.ends_on, raw],
    );
  }

  // Restriction.
  if (row.opportunitySpecific) {
    const cls = classifyRestriction(row.opportunitySpecific);
    await client.query(
      `INSERT INTO regs.opp_restriction (opportunity_id, restr_seq, restr_code, value_text, raw_text)
       VALUES ($1, 1, $2, $3, $4)`,
      [oppId, cls.restrCode, cls.valueText, row.opportunitySpecific],
    );
  }
  return true;
}

export async function loadDeaJson(jsonPath = process.env.DEA_JSON ?? DEFAULT_JSON): Promise<void> {
  const text = await readFile(jsonPath, "utf8");
  const parsed = JSON.parse(text) as { _meta: { pdf: string }; rows: DeaRow[] };
  const rows = parsed.rows;
  // The bundled extraction is the 2026 book.
  const seasonYear = 2026;

  const sd = await query<{ v: string }>(
    `SELECT source_doc_id::text AS v FROM regs.source_document WHERE season_year = $1 AND doc_code = 'dea-2026'`,
    [seasonYear],
  );
  const sourceDocId = sd.rows[0]?.v;
  if (!sourceDocId) throw new Error("Seed the 2026 source_document first (run npm run seed).");

  const report = { total: rows.length, staged: 0, promoted: 0, quarantined: 0, unparsedLicense: 0 };

  await withTransaction("etl", async (client) => {
    // Idempotent reload: clear DRAFT rows for the season (published rows untouched).
    await client.query(`DELETE FROM regs.opportunity WHERE season_year = $1 AND record_status = 'DRAFT'`, [seasonYear]);
    await client.query(`DELETE FROM regs.license_instrument WHERE season_year = $1 AND record_status = 'DRAFT'`, [seasonYear]);
    await client.query(`DELETE FROM regs.district_note WHERE season_year = $1 AND record_status = 'DRAFT'`, [seasonYear]);
    await client.query(
      `DELETE FROM regs.hunt_area_member WHERE hunt_area_id IN (SELECT hunt_area_id FROM regs.hunt_area WHERE season_year = $1)`,
      [seasonYear],
    );
    await client.query(`DELETE FROM regs.hunt_area WHERE season_year = $1`, [seasonYear]);
    await client.query(`DELETE FROM regs.stg_dea_row WHERE season_year = $1`, [seasonYear]);

    const caches: Caches = {
      districtId: new Map(), huntAreaId: new Map(), classId: new Map(),
      instrumentId: new Map(), splitSeq: new Map(),
    };
    const notesDone = new Set<string>();

    for (const row of rows) {
      const speciesRaw = (row.species ?? "").toUpperCase();
      let species: DeaSpecies | null =
        speciesRaw === "DEER" ? "deer" : speciesRaw === "ELK" ? "elk" : null;
      // Mislabeled-species recovery: the extraction tagged some genuine deer/elk district
      // rows (notably HD 388 Prickly Pear Valley's weapons-restriction split) as UNKNOWN.
      // Infer the species from the license/opportunity text, guarding against the subject-
      // index/TOC fragments (dot-leaders "… 15") that also leaked in with an UNKNOWN tag.
      if (!species && speciesRaw === "UNKNOWN") {
        const text = `${row.license ?? ""} ${row.opportunity ?? ""}`;
        const isIndexFragment = /\.\s*\.\s*\./.test(text);
        if (!isIndexFragment) {
          if (/\bdeer\b/i.test(text)) species = "deer";
          else if (/\belk\b/i.test(text)) species = "elk";
        }
      }

      // Stage every row.
      await client.query(
        `INSERT INTO regs.stg_dea_row
           (season_year, hd, district_name, region, species, license, opportunity, apply_by_date,
            quota, quota_range, early_dates, archery_dates, general_dates, heritage_ml_dates, late_dates,
            opp_specific, district_notes, raw_row, load_status, quarantine_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          seasonYear, row.hd, clip(row.districtName, 120), row.region, speciesRaw, clip(row.license, 200), clip(row.opportunity, 200),
          row.applyByDate, parseQuota(row.quota).current, row.quotaRange, row.earlySeasonDates, row.archeryDates,
          row.generalDates, row.heritageMuzzleloaderDates, row.lateSeasonDates, row.opportunitySpecific,
          (row.districtNotes ?? []).join(" | "), row.rawRow,
          species ? "NEW" : "QUARANTINED",
          species ? null : `species=${speciesRaw} (Phase B)`,
        ],
      );
      report.staged += 1;
      if (!species) {
        report.quarantined += 1;
        continue;
      }

      // District notes (once per hd).
      if (row.districtNotes && row.districtNotes.length > 0 && !notesDone.has(row.hd)) {
        const districtId = await ensureDistrict(client, caches, seasonYear, row.hd, row.region, row.districtName);
        for (const note of row.districtNotes) {
          await client.query(
            `INSERT INTO regs.district_note (season_year, district_id, note_text, updated_by, source_doc_id)
             VALUES ($1,$2,$3,'etl',$4)`,
            [seasonYear, districtId, note, sourceDocId],
          );
        }
        notesDone.add(row.hd);
      }

      let ok: boolean;
      try {
        ok = await promoteRow(client, caches, seasonYear, sourceDocId, species, row);
      } catch (err) {
        console.error("PROMOTE FAILED hd=%s license=%j opp=%j", row.hd, row.license, row.opportunity);
        throw err;
      }
      if (ok) report.promoted += 1;
      else report.unparsedLicense += 1;
    }
  });

  console.log("── ETL Phase A report ─────────────────────────");
  console.log(`  season year:      ${seasonYear}`);
  console.log(`  rows in source:   ${report.total}`);
  console.log(`  staged:           ${report.staged}`);
  console.log(`  promoted (D/E):   ${report.promoted}`);
  console.log(`  quarantined:      ${report.quarantined} (~149 antelope → superseded by loadAntelope; ~3 subject-index fragments)`);
  console.log(`  unparsed license: ${report.unparsedLicense} (residual — see etl-provenance.md)`);
  // Residual breakdown (2026 book): ~171 are duplicate wrapped-cell fragments whose license
  // code is already promoted in the same HD (safe to drop); ~14 are Permit rows whose animal
  // class was lost in the multi-line cell split; the rest are General-License header remnants
  // whose opportunities were recovered as continuation rows. None represent silently-missing
  // promotable opportunities beyond the documented ~14 Permit-class losses.
}

const isMain = process.argv[1]?.endsWith("loadDeaJson.ts") || process.argv[1]?.endsWith("loadDeaJson.js");
if (isMain) {
  loadDeaJson()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      void closePool().finally(() => process.exit(1));
    });
}
