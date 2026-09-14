/**
 * @file districtSeasonWindows.ts
 * @module engage-mt/services/hunt
 * @description Derive authoritative per-species season windows from a
 *              `DistrictRegulationsBundle` (FWP Regs Manager API →
 *              `useDistrictRegulations`). Shared by the district Seasons tab
 *              (`DistrictSeasonWindows`), the Season & Regulation lookup, and
 *              the Unit Scouting Report so the humanize + distinct-window logic
 *              lives in exactly one place — replacing the provisional
 *              `formatSeasonRange` path that read the dropped fixture columns.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type {
  DistrictRegulationRow,
  DistrictRegulationsBundle,
} from "@/hooks/useDistrictRegulations";

export type SpeciesKey = "deer" | "elk" | "antelope";

/** The per-weapon date columns on a row, in the order FWP prints them. */
const WEAPON_COLUMNS: ReadonlyArray<{ key: keyof DistrictRegulationRow; label: string }> = [
  { key: "earlySeasonDates", label: "Early season" },
  { key: "archeryDates", label: "Archery" },
  { key: "generalDates", label: "General" },
  { key: "heritageMuzzleloaderDates", label: "Heritage / muzzleloader" },
  { key: "lateSeasonDates", label: "Late season" },
];

export interface WeaponWindow {
  label: string;
  value: string;
}

/**
 * API ranges arrive as "Oct 24-Nov 29" (hyphen, no year). Humanize to an
 * en-dash with breathing room. No year to parse — the effective window is the
 * current regulation cycle carried by the bundle's `_source`.
 */
export const humanizeSeasonRange = (range: string): string =>
  range.trim().replace(/\s*[-–]\s*/g, " – ");

/** Distinct weapon windows for a set of species rows, in WEAPON_COLUMNS order. */
export const collectSeasonWindows = (
  rows: readonly DistrictRegulationRow[],
): readonly WeaponWindow[] => {
  const byLabel = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const { key, label } of WEAPON_COLUMNS) {
      const raw = row[key];
      if (typeof raw !== "string" || !raw.trim()) continue;
      const set = byLabel.get(label) ?? new Set<string>();
      for (const piece of raw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean))
        set.add(piece);
      byLabel.set(label, set);
    }
  }
  return WEAPON_COLUMNS.filter(({ label }) => byLabel.has(label)).map(({ label }) => ({
    label,
    value: [...byLabel.get(label)!].map(humanizeSeasonRange).join(", "),
  }));
};

/**
 * The general (or, for antelope, season) window for a species — a compact,
 * humanized headline string. Returns `null` when the bundle carries no such
 * window (so callers can fall back to a "see regs" affordance).
 */
export const headlineGeneralWindow = (
  bundle: DistrictRegulationsBundle | null,
  species: SpeciesKey,
): string | null => {
  const rows = bundle?.byCategory[species] ?? [];
  for (const r of rows) {
    const raw = r.generalDates ?? r.seasonDates;
    if (typeof raw === "string" && raw.trim()) {
      return humanizeSeasonRange(raw.split(",")[0].trim());
    }
  }
  return null;
};
