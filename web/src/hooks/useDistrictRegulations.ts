/**
 * @file useDistrictRegulations.ts
 * @module engage-mt/hooks
 * @description Read per-district deer/elk/antelope regulations. Rows come from the
 *              FWP Regs Manager API (`fetchHuntingRegs`) and
 *              are adapted from the flat `NormalizedRegulation` shape into the
 *              per-season-column `DistrictRegulationRow` this hook's consumers
 *              (`DistrictRegulationsPanel`, `DistrictDetailTabs`) render. DEA is the only
 *              species set in the DB today; other species surface a "not in database
 *              yet" notice elsewhere. District NOTEs (CWD sampling, closures) come from
 *              the v2 district-notes endpoint; a freshness descriptor is threaded through
 *              so the panel can label live-vs-cached (never present cached data as live).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-14
 * @version 2.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { fetchHuntingRegs, type RegsFreshness } from "@/services/hunt/fetchHuntingRegs";
import type { NormalizedRegulation } from "@/services/hunt/regsTypes";
import { fetchDistrictNotes, notesByDistrict } from "@/services/regsApi/districtNotes";

export interface DistrictRegulationRow {
  hd: string;
  districtName: string;
  region: number;
  districtNotes: readonly string[];
  species: "DEER" | "ELK" | "ANTELOPE" | "UNKNOWN";
  license: string | null;
  opportunity: string | null;
  applyByDate: string | null;
  quota: number | "UNL" | null;
  quotaRange: string | null;
  earlySeasonDates: string | null;
  archeryDates: string | null;
  generalDates: string | null;
  heritageMuzzleloaderDates: string | null;
  lateSeasonDates: string | null;
  seasonDates: string | null; // antelope-only field
  opportunitySpecific: string | null;
  /** Sub-district portion this reg is scoped to (e.g. "…South of Rock Creek"), else null. */
  portionName: string | null;
  /** SHAPECODE of that portion — matches a tap-resolved portion polygon (else null). */
  portionCode: string | null;
  rawRow: string;
  _source: {
    pdf: string;
    pdfFile: string;
    commissionAdoptedAt: string;
    validUntil: string;
    page?: number | null;
  };
}

export interface DistrictRegulationsBundle {
  hd: string;
  name: string;
  region: number;
  notes: readonly string[];
  rows: readonly DistrictRegulationRow[];
  /** Freshness of the underlying regs fetch (which tier served it, version, stale). */
  freshness: RegsFreshness;
  /** Convenience groupings by species, in display order. */
  byCategory: {
    deer: DistrictRegulationRow[];
    elk: DistrictRegulationRow[];
    antelope: DistrictRegulationRow[];
  };
}

interface RawPayload {
  districts: Array<{ hd: string; name: string; region: number; notes: string[] }>;
  rows: DistrictRegulationRow[];
  freshness: RegsFreshness;
}

const WEAPON_TO_COL: Record<string, keyof DistrictRegulationRow> = {
  Early: "earlySeasonDates",
  Archery: "archeryDates",
  General: "generalDates",
  Muzzleloader: "heritageMuzzleloaderDates",
  Late: "lateSeasonDates",
};

/** Adapt an API NormalizedRegulation into the per-season-column row shape. */
function toRow(r: NormalizedRegulation): DistrictRegulationRow {
  const cols: Partial<Record<keyof DistrictRegulationRow, string | null>> = {
    earlySeasonDates: null,
    archeryDates: null,
    generalDates: null,
    heritageMuzzleloaderDates: null,
    lateSeasonDates: null,
  };
  for (const w of r.weapon_windows) {
    const key = WEAPON_TO_COL[w.weapon];
    if (key) cols[key] = cols[key] ? `${cols[key]}, ${w.range}` : w.range;
  }
  const species =
    r.species === "deer"
      ? "DEER"
      : r.species === "elk"
        ? "ELK"
        : r.species === "antelope"
          ? "ANTELOPE"
          : "UNKNOWN";
  return {
    hd: r.geography_id,
    districtName: r.district_name ?? "",
    region: r.region ?? 0,
    districtNotes: [],
    species: species as DistrictRegulationRow["species"],
    license: r.required_license,
    opportunity: r.legal_animal,
    applyByDate: r.apply_by_date,
    quota: r.quota,
    quotaRange: null,
    earlySeasonDates: cols.earlySeasonDates ?? null,
    archeryDates: cols.archeryDates ?? null,
    generalDates: cols.generalDates ?? null,
    heritageMuzzleloaderDates: cols.heritageMuzzleloaderDates ?? null,
    lateSeasonDates: cols.lateSeasonDates ?? null,
    seasonDates: r.species === "antelope" ? (cols.generalDates ?? null) : null,
    opportunitySpecific: r.opportunity_specific,
    portionName: r.portion_name ?? null,
    portionCode: r.portion_code ?? null,
    rawRow: `${r.required_license} ${r.legal_animal}`,
    _source: {
      pdf: r.source_reg_id,
      pdfFile: `${r.source_reg_id}.pdf`,
      commissionAdoptedAt: r.effective_date,
      validUntil: r.expires_date ?? "",
    },
  };
}

async function loadAll(): Promise<RawPayload> {
  // The regs fetcher owns caching (session TTL, stored copies, bundle), so
  // every lookup asks it again and adapts the rows it returns.
  const { rows, freshness } = await fetchHuntingRegs();
  // District notes are a separate endpoint; fail-soft so a notes outage never
  // blocks the regulation rows.
  let notesMap = new Map<string, string[]>();
  try {
    const notes = await fetchDistrictNotes();
    notesMap = notesByDistrict(notes.data);
  } catch {
    notesMap = new Map();
  }
  const adapted = rows
    .filter((r) => r.species === "deer" || r.species === "elk" || r.species === "antelope")
    .map(toRow);
  const districts = new Map<
    string,
    { hd: string; name: string; region: number; notes: string[] }
  >();
  for (const r of adapted) {
    if (!districts.has(r.hd)) {
      districts.set(r.hd, {
        hd: r.hd,
        name: r.districtName,
        region: r.region,
        notes: notesMap.get(r.hd) ?? [],
      });
    }
  }
  return { districts: [...districts.values()], rows: adapted, freshness };
}

export interface UseDistrictRegulationsResult {
  loading: boolean;
  error: Error | null;
  data: DistrictRegulationsBundle | null;
}

export function useDistrictRegulations(
  district: string | null | undefined,
): UseDistrictRegulationsResult {
  const [state, setState] = useState<UseDistrictRegulationsResult>({
    loading: !!district,
    error: null,
    data: null,
  });

  useEffect(() => {
    if (!district) {
      setState({ loading: false, error: null, data: null });
      return;
    }
    let alive = true;
    setState({ loading: true, error: null, data: null });
    loadAll()
      .then((payload) => {
        if (!alive) return;
        const meta = payload.districts.find((d) => d.hd === district);
        const rows = payload.rows.filter((r) => r.hd === district);
        if (!meta) {
          setState({
            loading: false,
            error: null,
            data: null,
          });
          return;
        }
        setState({
          loading: false,
          error: null,
          data: {
            hd: meta.hd,
            name: meta.name,
            region: meta.region,
            notes: meta.notes,
            rows,
            freshness: payload.freshness,
            byCategory: {
              deer: rows.filter((r) => r.species === "DEER"),
              elk: rows.filter((r) => r.species === "ELK"),
              antelope: rows.filter((r) => r.species === "ANTELOPE"),
            },
          },
        });
      })
      .catch((err) => {
        if (!alive) return;
        setState({
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
          data: null,
        });
      });
    return () => {
      alive = false;
    };
  }, [district]);

  return state;
}
