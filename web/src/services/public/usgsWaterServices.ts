/**
 * @file usgsWaterServices.ts
 * @module engage-mt/services/public
 * @description Client for the USGS Water Services instantaneous-values API
 *              (NWIS). Fetches the latest discharge and water temperature for
 *              a set of gage sites and keeps a last-good snapshot so an
 *              offline card can still show its most recent reading.
 *              Public anonymous API; errors are typed per `utils/errors`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { fetchJson, withBackoff } from "@/utils/http";
import { DataError } from "@/utils/errors";
import { makeSnapshotStore } from "@/services/cache/snapshotStore";

const BASE = "https://waterservices.usgs.gov/nwis";

/** NWIS parameter codes the gage card reads. */
export const USGS_PARAM = {
  discharge_cfs: "00060",
  water_temperature_c: "00010",
} as const;

export type UsgsParam = keyof typeof USGS_PARAM;

export interface UsgsObservation {
  siteCode: string;
  siteName: string;
  param: UsgsParam;
  value: number;
  units: string;
  observedAt: string;
}

export interface UsgsLatestResult {
  observations: UsgsObservation[];
  /** True when served from the last-good snapshot rather than a fresh fetch. */
  fromCache: boolean;
  /** ISO — newest observation time (fresh) or when the snapshot was cached. */
  observedAt: string | null;
}

interface NwisResponse {
  value: {
    timeSeries: Array<{
      sourceInfo: { siteName: string; siteCode: Array<{ value: string }> };
      variable: {
        variableName: string;
        variableCode?: Array<{ value: string }>;
        unit: { unitCode: string };
      };
      values: Array<{ value: Array<{ value: string; dateTime: string }> }>;
    }>;
  };
}

const latestSnapshotStore = makeSnapshotStore("engage-usgs-latest");

const latestCacheKey = (siteCodes: readonly string[], params: readonly UsgsParam[]): string =>
  `${[...siteCodes].sort().join(",")}::${[...params].sort().join(",")}`;

/** Most recent observation time across a set, or null when none carry one. */
const latestObservedAt = (observations: readonly UsgsObservation[]): string | null => {
  let newest: string | null = null;
  for (const o of observations) {
    if (o.observedAt && (!newest || o.observedAt > newest)) newest = o.observedAt;
  }
  return newest;
};

const codeToParam = (code: string): UsgsParam | null => {
  for (const [key, val] of Object.entries(USGS_PARAM)) {
    if (val === code) return key as UsgsParam;
  }
  return null;
};

/** Fallback when a series omits its parameter code: infer from the unit text. */
const paramFromUnits = (units: string): UsgsParam | null => {
  const u = units.toLowerCase();
  if (u.includes("ft3") || u.includes("ft³")) return "discharge_cfs";
  if (u.includes("deg")) return "water_temperature_c";
  return null;
};

/**
 * Fetch the latest instantaneous values for one or more sites and parameters:
 *   /iv/?sites=06054500,06065500&parameterCd=00060,00010&format=json
 */
export const fetchLatestObservations = async (
  siteCodes: readonly string[],
  params: readonly UsgsParam[],
): Promise<UsgsObservation[]> => {
  if (siteCodes.length === 0 || params.length === 0) return [];
  const paramCodes = params.map((p) => USGS_PARAM[p]).join(",");
  const url = `${BASE}/iv/?sites=${siteCodes.join(",")}&parameterCd=${paramCodes}&format=json`;
  const result = await withBackoff<NwisResponse>(() => fetchJson<NwisResponse>(url));
  if (!result?.value?.timeSeries) {
    throw new DataError("USGS NWIS returned an unexpected payload shape");
  }
  const observations: UsgsObservation[] = [];
  for (const ts of result.value.timeSeries) {
    const code = ts.variable?.variableCode?.[0]?.value;
    const units = ts.variable?.unit?.unitCode ?? "";
    const param = (code ? codeToParam(code) : null) ?? paramFromUnits(units);
    const value = Number(ts.values?.[0]?.value?.[0]?.value);
    if (!param || !Number.isFinite(value)) continue;
    observations.push({
      siteCode: ts.sourceInfo.siteCode?.[0]?.value ?? "",
      siteName: ts.sourceInfo.siteName,
      param,
      value,
      units,
      observedAt: ts.values?.[0]?.value?.[0]?.dateTime ?? "",
    });
  }
  return observations;
};

/**
 * Fetch the latest readings, persisting a last-good snapshot on success and
 * falling back to it when the network fails. Rethrows only when the fetch
 * fails AND no snapshot exists.
 */
export const fetchLatestObservationsCached = async (
  siteCodes: readonly string[],
  params: readonly UsgsParam[],
): Promise<UsgsLatestResult> => {
  if (siteCodes.length === 0 || params.length === 0) {
    return { observations: [], fromCache: false, observedAt: null };
  }
  const key = latestCacheKey(siteCodes, params);
  try {
    const observations = await fetchLatestObservations(siteCodes, params);
    const observedAt = latestObservedAt(observations);
    void latestSnapshotStore.write(key, { observations }, observedAt ?? new Date().toISOString());
    return { observations, fromCache: false, observedAt };
  } catch (err) {
    const raw = await latestSnapshotStore.read(key);
    const body = raw?.body as { observations?: UsgsObservation[] } | undefined;
    if (body?.observations) {
      return {
        observations: body.observations,
        fromCache: true,
        observedAt: raw?.fetchedAt ?? null,
      };
    }
    throw err;
  }
};
