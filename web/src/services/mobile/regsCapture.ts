/**
 * @file regsCapture.ts
 * @module engage-mt/services/mobile
 * @description The regulations leg of an offline area download. Forces a
 *              fresh copy of every regulations dataset onto the device (the
 *              fetcher writes its field copy), then records the hunting
 *              districts inside the area with their live district facts in a
 *              per-area file so the district pages resolve with no signal.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { isCapacitor } from "@/utils/capacitor";
import { createLogger } from "@/utils/logger";
import { fetchHuntingRegs } from "@/services/hunt/fetchHuntingRegs";
import { fetchDistrictNotes } from "@/services/regsApi/districtNotes";
import { fetchRestrictedAreas } from "@/services/regsApi/restrictedAreas";
import { fetchYouthOpportunities } from "@/services/regsApi/youthOpportunities";
import { fetchCorrections } from "@/services/regsApi/corrections";
import { currentRegsYear } from "@/services/regsApi/year";
import {
  fetchDistrictFactsLive,
  type LiveDistrictFacts,
} from "@/services/hunt/huntingDistrictsLive";
import { listDownloadedAreas } from "./offlineTileResolver";
import type { CachedLayerPayload } from "./vectorDownloader";

const log = createLogger("regs-capture");
const DISTRICT_LAYER_ID = "hunting-districts";
const FACTS_CONCURRENCY = 4;

export interface CapturedAreaRegs {
  areaId: string;
  capturedAt: string;
  /** Published regulations version the unified table carried. */
  version: number | null;
  districts: string[];
  facts: Record<string, LiveDistrictFacts>;
}

export interface RegsCaptureProgress {
  step: number;
  total: number;
  failed: number;
  percent: number;
}

export interface RegsCaptureResult {
  ok: boolean;
  version: number | null;
  districts: string[];
  bytes: number;
}

interface MinimalFs {
  readFile: (opts: {
    path: string;
    directory: string;
    encoding: string;
  }) => Promise<{ data: string }>;
  writeFile: (opts: {
    path: string;
    data: string;
    directory: string;
    encoding: string;
    recursive?: boolean;
  }) => Promise<unknown>;
}

export const areaRegsPath = (areaId: string): string => `regs/areas/${areaId}.json`;

const filesystem = async (): Promise<{ fs: MinimalFs; directory: string }> => {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  return {
    fs: Filesystem as unknown as MinimalFs,
    directory: (Directory as unknown as Record<string, string>).Data,
  };
};

/** District codes from the area's cached hunting-districts layer. */
export const districtsInArea = async (areaId: string): Promise<string[]> => {
  try {
    const { fs, directory } = await filesystem();
    const { data } = await fs.readFile({
      path: `data/${areaId}/${DISTRICT_LAYER_ID}.json`,
      directory,
      encoding: "utf8",
    });
    const payload = JSON.parse(data) as CachedLayerPayload;
    const codes = new Set<string>();
    for (const f of payload.features ?? []) {
      const raw = f.attributes?.DISTRICT;
      const code =
        typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
      if (/^\d{3}$/.test(code)) codes.add(code);
    }
    return [...codes].sort();
  } catch {
    return [];
  }
};

const mapConcurrent = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> => {
  const out: R[] = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }).map(async () => {
      while (index < items.length) {
        const i = index++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
};

export const captureAreaRegs = async (opts: {
  areaId: string;
  signal?: AbortSignal;
  onProgress?: (p: RegsCaptureProgress) => void;
}): Promise<RegsCaptureResult> => {
  if (!isCapacitor()) {
    opts.onProgress?.({ step: 0, total: 0, failed: 0, percent: 100 });
    return { ok: true, version: null, districts: [], bytes: 0 };
  }
  const year = currentRegsYear();
  const datasets: Array<() => Promise<number | null>> = [
    async () => (await fetchHuntingRegs(true)).freshness.version,
    async () => (await fetchDistrictNotes(year, true)).freshness.version,
    async () => (await fetchRestrictedAreas(year, true)).freshness.version,
    async () => (await fetchYouthOpportunities(year, true)).freshness.version,
    async () => (await fetchCorrections(year, true)).freshness.version,
  ];
  const progress: RegsCaptureProgress = {
    step: 0,
    total: datasets.length + 1,
    failed: 0,
    percent: 0,
  };
  const report = (): void => {
    progress.percent = Math.round((progress.step / progress.total) * 100);
    opts.onProgress?.(progress);
  };

  let version: number | null = null;
  for (const [i, load] of datasets.entries()) {
    if (opts.signal?.aborted) break;
    try {
      const v = await load();
      if (i === 0) version = v;
    } catch (err) {
      progress.failed += 1;
      log.warn("regs dataset capture failed", { error: String(err) });
    }
    progress.step += 1;
    report();
  }

  const districts = await districtsInArea(opts.areaId);
  const facts: Record<string, LiveDistrictFacts> = {};
  const resolved = await mapConcurrent(districts, FACTS_CONCURRENCY, (hd) =>
    fetchDistrictFactsLive(hd, opts.signal).catch(() => null),
  );
  resolved.forEach((f, i) => {
    if (f) facts[districts[i]] = f;
  });

  const captured: CapturedAreaRegs = {
    areaId: opts.areaId,
    capturedAt: new Date().toISOString(),
    version,
    districts,
    facts,
  };
  const serialized = JSON.stringify(captured);
  let bytes = 0;
  try {
    const { fs, directory } = await filesystem();
    await fs.writeFile({
      path: areaRegsPath(opts.areaId),
      data: serialized,
      directory,
      encoding: "utf8",
      recursive: true,
    });
    bytes = serialized.length;
  } catch (err) {
    progress.failed += 1;
    log.warn("area regs write failed", { areaId: opts.areaId, error: String(err) });
  }
  progress.step += 1;
  report();
  return { ok: progress.failed === 0, version, districts, bytes };
};

export const readCapturedAreaRegs = async (areaId: string): Promise<CapturedAreaRegs | null> => {
  if (!isCapacitor()) return null;
  try {
    const { fs, directory } = await filesystem();
    const { data } = await fs.readFile({ path: areaRegsPath(areaId), directory, encoding: "utf8" });
    const parsed = JSON.parse(data) as Partial<CapturedAreaRegs>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.areaId !== "string") return null;
    return {
      areaId: parsed.areaId,
      capturedAt: parsed.capturedAt ?? "",
      version: typeof parsed.version === "number" ? parsed.version : null,
      districts: Array.isArray(parsed.districts) ? parsed.districts : [],
      facts: parsed.facts ?? {},
    };
  } catch {
    return null;
  }
};

/** District facts saved with any downloaded area, for when the live lookup cannot run. */
export const capturedDistrictFacts = async (
  district: string,
): Promise<LiveDistrictFacts | null> => {
  if (!isCapacitor()) return null;
  for (const area of listDownloadedAreas()) {
    const captured = await readCapturedAreaRegs(area.id);
    const facts = captured?.facts[district];
    if (facts) return facts;
  }
  return null;
};
