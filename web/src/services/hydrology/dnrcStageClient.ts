/**
 * @file dnrcStageClient.ts
 * @module engage-mt/services/hydrology
 * @description Live-reading client for the Montana DNRC StAGE service
 *              (`gis.dnrc.mt.gov/.../WRD/WMB_StAGE/MapServer`). The map layer
 *              (`MapServer/0`) ships station locations only; the current
 *              readings live in the related `locationDatasets` table (index 4),
 *              one row per sensor keyed by `LocationCode`. This module fetches
 *              those rows and reduces them to the three numbers the gage card
 *              shows: discharge (cfs), water temperature (°F), gage height (ft).
 *
 *              The relationship table only honors `LocationCode` in a WHERE
 *              clause, so every query is key-scoped. Anonymous public
 *              `*.mt.gov` service; no user data leaves the device.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { fetchArcgisQuery } from "@/utils/http";
import { ttlCache } from "@/services/cache/ttlCache";
import { cToF } from "@/utils/units";

const BASE = "https://gis.dnrc.mt.gov/arcgis/rest/services/WRD/WMB_StAGE/MapServer";
const LOCATION_DATASETS_TABLE = 4;
const SENSOR_TTL_MS = 15 * 60 * 1000;

/** DNRC encodes "no data" as a null, a negative, or a 9,999,999-style sentinel. */
const isSentinel = (v: unknown): boolean =>
  v == null || typeof v !== "number" || Number.isNaN(v) || v < 0 || v >= 9_999_999;

type SensorKind = "flow" | "temp" | "stage" | "other";

export interface DnrcSensor {
  sensorId: string;
  kind: SensorKind;
  /** Reading in the card's display unit (cfs, °F, ft). Null when not reporting. */
  value: number | null;
  /** Epoch ms of the reading, when the service supplies one. */
  observedAt: number | null;
}

export interface DnrcStage {
  locationCode: string;
  cfs: number | null;
  tempF: number | null;
  stageFt: number | null;
  observedAt: number | null;
}

interface RawSensorAttrs {
  SensorID?: unknown;
  Parameter?: unknown;
  UnitOfMeasure?: unknown;
  RecordedValue?: unknown;
  RecordedOn?: unknown;
}

interface ArcgisQueryResult<A> {
  features?: Array<{ attributes: A }>;
}

/** Map a DNRC parameter code + unit onto the card's sensor kinds. */
const classify = (parameter: string, unit: string): { kind: SensorKind; celsius: boolean } => {
  const p = parameter.toUpperCase();
  const u = unit.toLowerCase();
  if (p === "QR" || p === "QC" || u === "ft^3/s" || u === "ft³/s" || u === "cfs") {
    return { kind: "flow", celsius: false };
  }
  if (p === "HG" || u === "ft") return { kind: "stage", celsius: false };
  if (p === "WT" || p === "TW" || u.includes("deg") || u.includes("°")) {
    return { kind: "temp", celsius: u.includes("c") };
  }
  return { kind: "other", celsius: false };
};

const asMs = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Current reading for every sensor at a station, temperatures normalized to °F. */
export const fetchDnrcSensors = (locationCode: string): Promise<DnrcSensor[]> => {
  if (!locationCode) return Promise.resolve([]);
  return ttlCache("dnrc-sensors", locationCode, SENSOR_TTL_MS, async () => {
    const url =
      `${BASE}/${LOCATION_DATASETS_TABLE}/query?` +
      new URLSearchParams({
        where: `LocationCode='${locationCode.replace(/'/g, "''")}'`,
        outFields: "SensorID,Parameter,UnitOfMeasure,RecordedValue,RecordedOn",
        returnGeometry: "false",
        f: "json",
      }).toString();
    const data = await fetchArcgisQuery<ArcgisQueryResult<RawSensorAttrs>>(url);
    const sensors: DnrcSensor[] = [];
    for (const f of data?.features ?? []) {
      const a = f.attributes;
      const sensorId = a.SensorID == null ? "" : String(a.SensorID);
      if (!sensorId) continue;
      const { kind, celsius } = classify(String(a.Parameter ?? ""), String(a.UnitOfMeasure ?? ""));
      const raw = a.RecordedValue;
      let value = isSentinel(raw) ? null : (raw as number);
      if (value !== null && kind === "temp" && celsius) value = cToF(value);
      sensors.push({ sensorId, kind, value, observedAt: asMs(a.RecordedOn) });
    }
    return sensors;
  });
};

/** The most recently reporting sensor of a kind, or null when the station has none. */
const primary = (sensors: DnrcSensor[], kind: SensorKind): DnrcSensor | null => {
  const ofKind = sensors.filter((s) => s.kind === kind);
  if (ofKind.length === 0) return null;
  const reporting = ofKind.filter((s) => s.value !== null);
  const pool = reporting.length > 0 ? reporting : ofKind;
  return pool.reduce(
    (best, s) => ((s.observedAt ?? 0) > (best.observedAt ?? 0) ? s : best),
    pool[0]!,
  );
};

/** The three numbers the gage card shows for a DNRC station. */
export const fetchDnrcStage = async (locationCode: string): Promise<DnrcStage> => {
  const sensors = await fetchDnrcSensors(locationCode);
  const flow = primary(sensors, "flow");
  const temp = primary(sensors, "temp");
  const stage = primary(sensors, "stage");
  const observedAt = Math.max(flow?.observedAt ?? 0, temp?.observedAt ?? 0, stage?.observedAt ?? 0);
  return {
    locationCode,
    cfs: flow?.value ?? null,
    tempF: temp?.value ?? null,
    stageFt: stage?.value ?? null,
    observedAt: observedAt > 0 ? observedAt : null,
  };
};
