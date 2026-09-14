/**
 * @file deaParse.ts
 * @module engage-mt/server/etl
 * @description Pure parsing helpers for the DEA JSON seed: license-string → instrument,
 *              raw date range → resolved start/end dates (Nov→Feb wrap), and restriction
 *              classification. Pure + unit-testable; the loader wires them to the DB.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export type DeaSpecies = "deer" | "elk" | "antelope";

export interface ParsedInstrument {
  instrTypeCode: "GENERAL" | "PERMIT" | "B_LICENSE";
  /** NNN-NN or synthetic GEN-<species>. */
  instrCode: string;
  displayName: string;
  isDraw: boolean;
  /** Trailing class label bled into the license string, if any. */
  trailingLabel: string | null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parse a DEA `license` string into an instrument. The extraction sometimes bleeds
 * the animal-class label into the license column; we split it off as trailingLabel.
 */
export function parseInstrument(license: string, species: DeaSpecies): ParsedInstrument | null {
  const s = license.trim();
  const codeRe = /(\d{3}-\d{2})/;
  const speciesWord = species === "deer" ? "Deer" : species === "elk" ? "Elk" : "Antelope";

  // General License
  const genRe = new RegExp(`^General ${speciesWord} License\\b`, "i");
  if (genRe.test(s)) {
    const trailing = s.replace(genRe, "").trim();
    return {
      instrTypeCode: "GENERAL",
      instrCode: `GEN-${species.toUpperCase()}`,
      displayName: `General ${speciesWord} License`,
      isDraw: false,
      trailingLabel: trailing.length > 0 ? trailing : null,
    };
  }

  // Species prefix for the internal instr_code. Deer and elk reuse the same printed license
  // numbers (e.g. "Deer B License: 100-00" AND "Elk B License: 100-00" are DIFFERENT licenses),
  // so the internal instr_code must be species-namespaced or they collide on the
  // (season_year, instr_code) uniqueness constraint (General is already GEN-DEER/GEN-ELK). The
  // printed number stays verbatim in display_name; instr_code only feeds the synthetic rule_id.
  const sp = species === "deer" ? "D" : "E";

  // B License (antlerless) — "Deer B License: 170-00 ..."
  const bRe = new RegExp(`^${speciesWord} B License`, "i");
  if (bRe.test(s)) {
    const code = codeRe.exec(s)?.[1] ?? `B-${species.toUpperCase()}`;
    const trailing = s.replace(new RegExp(`^${speciesWord} B License:?\\s*${code}`, "i"), "").trim();
    return {
      instrTypeCode: "B_LICENSE",
      instrCode: `${sp}-${code}`,
      displayName: `${speciesWord} B License: ${code}`,
      isDraw: !/OTC/i.test(s), // OTC B licenses aren't draws; refined by apply_by/otc in loader
      trailingLabel: trailing.length > 0 ? trailing : null,
    };
  }

  // Permit — "Deer Permit: 202-50 ..." (drawing only)
  const pRe = new RegExp(`^${speciesWord} Permit`, "i");
  if (pRe.test(s)) {
    const code = codeRe.exec(s)?.[1] ?? `P-${species.toUpperCase()}`;
    const trailing = s.replace(new RegExp(`^${speciesWord} Permit:?\\s*${code}`, "i"), "").trim();
    return {
      instrTypeCode: "PERMIT",
      instrCode: `${sp}-${code}`,
      displayName: `${speciesWord} Permit: ${code}`,
      isDraw: true,
      trailingLabel: trailing.length > 0 ? trailing : null,
    };
  }

  return null;
}

/**
 * Resolve a raw range ("Sep 05-Oct 18") to ISO start/end within a season year.
 * License year runs Mar 1 (year) → end Feb (year+1): months Mar–Dec map to the season
 * year, Jan–Feb map to season year + 1. A range whose end month precedes its start
 * month wraps into the next calendar year.
 */
export function resolveRange(
  raw: string,
  seasonYear: number,
): { starts_on: string; ends_on: string } | null {
  const m = /([A-Za-z]{3})\.?\s*(\d{1,2})\s*[-–]\s*([A-Za-z]{3})\.?\s*(\d{1,2})/.exec(raw.trim());
  if (!m) return null;
  const sMon = MONTHS[m[1]!.toLowerCase()];
  const eMon = MONTHS[m[3]!.toLowerCase()];
  if (!sMon || !eMon) return null;
  const sDay = Number(m[2]);
  const eDay = Number(m[4]);
  const yearForMonth = (mon: number): number => (mon >= 3 ? seasonYear : seasonYear + 1);
  const sYear = yearForMonth(sMon);
  let eYear = yearForMonth(eMon);
  // If end falls before start chronologically, push end into next year.
  if (eYear < sYear || (eYear === sYear && (eMon < sMon || (eMon === sMon && eDay < sDay)))) {
    eYear += 1;
  }
  const iso = (y: number, mo: number, d: number) =>
    `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { starts_on: iso(sYear, sMon, sDay), ends_on: iso(eYear, eMon, eDay) };
}

export interface ClassifiedRestriction {
  restrCode: string;
  valueText: string | null;
}

/** Classify a free-text opportunity-specific note into a structured restriction code. */
export function classifyRestriction(text: string): ClassifiedRestriction {
  const t = text.toLowerCase();
  const youth = /youth ages? (\d{1,2})\s*-\s*(\d{1,2})/.exec(t);
  if (youth) return { restrCode: "YOUTH_ONLY", valueText: `${youth[1]}-${youth[2]}` };
  if (/pthfv/.test(t)) return { restrCode: "PTHFV", valueText: null };
  if (/arch\s*equip|archery equipment|archequip/.test(t)) return { restrCode: "ARCHERY_EQUIP_ONLY", valueText: null };
  if (/private land/.test(t)) return { restrCode: "PRIVATE_LAND_ONLY", valueText: null };
  if (/outside.*national forest/.test(t)) return { restrCode: "OUTSIDE_NF_ONLY", valueText: null };
  if (/not valid on .*wma/.test(t)) return { restrCode: "NOT_WMA", valueText: null };
  if (/not valid on .*blm|blm lands/.test(t)) return { restrCode: "NOT_BLM", valueText: null };
  if (/dnrc lands/.test(t)) return { restrCode: "DNRC_VALID", valueText: null };
  const per = /up to (\w+) per hunter|(one) per hunter/.exec(t);
  if (per) return { restrCode: "PER_HUNTER_LIMIT", valueText: per[1] ?? per[2] ?? null };
  if (/must purchase before/.test(t)) return { restrCode: "PURCHASE_BEFORE", valueText: null };
  if (/first and only choice/.test(t)) return { restrCode: "FIRST_CHOICE_ONLY", valueText: null };
  if (/mandatory check/.test(t)) return { restrCode: "MANDATORY_CHECK", valueText: null };
  return { restrCode: "OTHER", valueText: null };
}

/** Slugify a class label to a stable class_code. */
export function classCodeFor(label: string): string {
  return label
    .toUpperCase()
    .replace(/WHITE-TAILED/g, "WTD")
    .replace(/MULE DEER/g, "MD")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}
