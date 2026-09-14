/**
 * @file rekeyPortions.ts
 * @module engage-mt/server/etl
 * @description Re-keys portion-scoped opportunities off their whole-parent-district hunt
 *              area onto a PORTION-kind hunt area whose member is the matching
 *              regs.district_portion (run AFTER syncPortions). The matcher is deliberately
 *              HIGH-PRECISION / low-recall: it links only when the portion's core phrase
 *              (name minus the "Portion of HD N" prefix) appears in the opportunity's
 *              validity_note, the species aligns, the match is unambiguous, AND polarity
 *              aligns — a note that says "outside / not valid in X" is NEVER linked to the
 *              positive "X" polygon (that would invert the geography); it goes to review.
 *              Everything uncertain is LEFT on the district and surfaced by the
 *              PORTION_TEXT_UNLINKED validation check for manual staff wiring. Idempotent.
 *              Usage: `npm run etl:rekey-portions [year]` (default 2026).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { withTransaction, closePool, query } from "../db/pool.js";

export interface PortionCandidate {
  portion_id: string;
  portion_code: string;
  portion_name: string;
}

/** lowercase, alnum-only tokens, drop filler words, collapse — bridges phrasing drift. */
const FILLER = new Set(["of", "the", "a", "an"]);
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !FILLER.has(w))
    .join(" ")
    .trim();
}

/** Portion name minus the "Portion of HD NNN" prefix, normalized → the core phrase. */
export function portionCore(portionName: string): string {
  return normalize(portionName.replace(/^\s*portion of (?:hd|hunting district)\s*\d+\s*/i, ""));
}

const NEGATION = /\b(outside|not|except|excluding|beyond)\b/;

export type MatchResult =
  | { status: "link"; portion: PortionCandidate }
  | { status: "review"; reason: string }
  | { status: "none" };

/**
 * Decide whether an opportunity's note maps to exactly one candidate portion.
 * `candidates` must already be filtered to the opp's parent district + species.
 */
export function matchPortion(note: string, candidates: PortionCandidate[]): MatchResult {
  const normNote = normalize(note);
  if (!normNote) return { status: "none" };
  const hits = candidates
    .map((p) => ({ p, core: portionCore(p.portion_name) }))
    .filter((c) => c.core.length >= 4 && normNote.includes(c.core))
    .sort((a, b) => b.core.length - a.core.length);
  if (hits.length === 0) return { status: "none" };

  // Ambiguity: two different cores of equal (max) length both present → don't guess.
  if (hits.length > 1 && hits[1]!.core.length === hits[0]!.core.length && hits[1]!.core !== hits[0]!.core)
    return { status: "review", reason: "ambiguous-multiple-portions" };

  const best = hits[0]!;
  // Polarity guard: if the portion is a POSITIVE area but the note negates it right before
  // the phrase ("outside/not valid in <core>"), this is a complement with no matching polygon.
  if (!NEGATION.test(best.core)) {
    const idx = normNote.indexOf(best.core);
    const before = normNote.slice(Math.max(0, idx - 28), idx);
    if (NEGATION.test(before)) return { status: "review", reason: "complement-no-polygon" };
  }
  return { status: "link", portion: best.p };
}

/** SHAPECODE prefix → the species token(s) a portion serves. */
function speciesPrefixes(speciesCode: string, legalAnimal: string): string[] {
  if (speciesCode === "elk") return ["elPt"];
  if (speciesCode === "antelope") return ["antPt"];
  if (speciesCode === "deer") {
    const la = legalAnimal.toLowerCase();
    if (la.includes("white") || la.includes("wtd")) return ["wtPt"];
    if (la.includes("mule")) return ["mdPt"];
    return ["mdPt", "wtPt"]; // generic deer → either
  }
  return [];
}

interface OppRow {
  opportunity_id: string;
  hunt_area_id: string;
  validity_note: string | null;
  species_code: string;
  legal_animal: string;
  geography_code: string;
  district_code: string;
}

const PORTION_TEXT = /portion|that part|east of|west of|north of|south of|outside|within|inside|wilderness|management zone/i;

export async function rekeyPortions(seasonYear: number): Promise<void> {
  // Candidate opps: active, single home district, portion-ish note.
  const opps = await query<OppRow>(
    `SELECT o.opportunity_id, o.hunt_area_id, o.validity_note, li.species_code,
            lac.display_label AS legal_animal, d.geography_code, d.district_code
     FROM regs.opportunity o
     JOIN regs.license_instrument li ON li.instrument_id = o.instrument_id
     JOIN regs.legal_animal_class lac ON lac.animal_class_id = o.animal_class_id
     JOIN regs.district d ON d.district_id = o.home_district_id
     WHERE o.season_year = $1 AND o.record_status <> 'ARCHIVED'
       AND o.validity_note IS NOT NULL`,
    [seasonYear],
  );

  // All portions for the year's districts, grouped by parent district_code + geography.
  const portions = await query<{ district_code: string; geography_code: string; portion_id: string; portion_code: string; portion_name: string }>(
    `SELECT d.district_code, d.geography_code, p.portion_id, p.portion_code, p.portion_name
     FROM regs.district_portion p JOIN regs.district d ON d.district_id = p.district_id`,
  );
  const byDistrict = new Map<string, PortionCandidate[]>();
  for (const r of portions.rows) {
    const k = `${r.geography_code}|${r.district_code}`;
    if (!byDistrict.has(k)) byDistrict.set(k, []);
    byDistrict.get(k)!.push({ portion_id: r.portion_id, portion_code: r.portion_code, portion_name: r.portion_name });
  }

  let linked = 0;
  const review: { opp: string; district: string; reason: string; note: string }[] = [];
  let skippedNoText = 0;

  await withTransaction("etl-portion-rekey", async (c) => {
    for (const o of opps.rows) {
      if (!o.validity_note || !PORTION_TEXT.test(o.validity_note)) { skippedNoText += 1; continue; }
      const all = byDistrict.get(`${o.geography_code}|${o.district_code}`) ?? [];
      const prefixes = speciesPrefixes(o.species_code, o.legal_animal ?? "");
      const candidates = all.filter((p) => prefixes.some((pre) => p.portion_code.startsWith(pre)));
      if (candidates.length === 0) {
        review.push({ opp: o.opportunity_id, district: o.district_code, reason: "no-portion-for-district-species", note: o.validity_note.slice(0, 70) });
        continue;
      }
      const m = matchPortion(o.validity_note, candidates);
      if (m.status === "link") {
        // Ensure a PORTION hunt area for this portion (shared, deterministic code).
        const areaCode = `PORT-${m.portion.portion_code}`;
        const ha = await c.query<{ hunt_area_id: string }>(
          `INSERT INTO regs.hunt_area (season_year, area_code, area_kind, definition_text, updated_by)
           VALUES ($1,$2,'PORTION',$3,'etl-portion-rekey')
           ON CONFLICT (season_year, area_code) DO UPDATE SET updated_by = 'etl-portion-rekey'
           RETURNING hunt_area_id`,
          [seasonYear, areaCode, m.portion.portion_name],
        );
        const haId = ha.rows[0]!.hunt_area_id;
        await c.query(
          `INSERT INTO regs.hunt_area_member (hunt_area_id, member_seq, portion_id)
           VALUES ($1,1,$2) ON CONFLICT (hunt_area_id, member_seq) DO UPDATE SET portion_id = EXCLUDED.portion_id, district_id = NULL`,
          [haId, m.portion.portion_id],
        );
        if (o.hunt_area_id !== haId) {
          await c.query(
            `UPDATE regs.opportunity SET hunt_area_id = $1, revision = revision + 1,
               updated_by = 'etl-portion-rekey', updated_at = CURRENT_TIMESTAMP
             WHERE opportunity_id = $2`,
            [haId, o.opportunity_id],
          );
        }
        linked += 1;
      } else if (m.status === "review") {
        review.push({ opp: o.opportunity_id, district: o.district_code, reason: m.reason, note: o.validity_note.slice(0, 70) });
      }
      // status "none" = note had portion-ish words but no core phrase matched a real
      // polygon (e.g. "NOT valid on FWP WMAs" land-overlay) — not a portion; leave silent.
    }
  });

  console.log(`── portion re-key (season ${seasonYear}) ──`);
  console.log(`  linked:   ${linked} opportunities → PORTION hunt areas`);
  console.log(`  review:   ${review.length} (portion-text but not auto-linked — staff wire manually)`);
  console.log(`  (skipped ${skippedNoText} opps with no portion-ish text)`);
  const byReason = new Map<string, number>();
  for (const r of review) byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);
  for (const [reason, n] of byReason) console.log(`     · ${reason}: ${n}`);
  if (review.length) {
    console.log("  ── review detail ──");
    for (const r of review) console.log(`     HD ${r.district} [${r.reason}] "${r.note}"`);
  }
}

const isMain = process.argv[1]?.endsWith("rekeyPortions.ts") || process.argv[1]?.endsWith("rekeyPortions.js");
if (isMain) {
  const year = Number(process.argv[2]) || 2026;
  rekeyPortions(year)
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      void closePool().finally(() => process.exit(1));
    });
}
