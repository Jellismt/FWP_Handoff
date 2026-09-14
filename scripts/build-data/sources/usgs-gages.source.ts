/**
 * @file usgs-gages.source.ts
 * @module engage-mt/build-data
 * @description Active Montana USGS stream gages that report instantaneous
 *              discharge, from the NWIS Site Service. When the service cannot
 *              be reached the committed catalog is kept as-is (set
 *              USGS_GAGES_REQUIRE_FETCH=1 to fail instead, as a release build
 *              should).
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRdb, toGageRows } from "../lib/nwisRdb.mjs";

export interface UsgsGageRow {
  site_no: string;
  name: string;
  river: string;
  lat: number;
  lon: number;
  type: "stream";
}

export const NWIS_SITE_URL =
  "https://waterservices.usgs.gov/nwis/site/?format=rdb&stateCd=mt&siteType=ST&siteStatus=active&hasDataTypeCd=iv&parameterCd=00060";

const HERE = dirname(fileURLToPath(import.meta.url));
const COMMITTED = resolve(HERE, "../../../web/public/data/usgs-gages.json");
const MANIFEST = resolve(HERE, "../../../web/public/data/data-manifest.json");
const MIN_SITES = 100;

const today = (): string => new Date().toISOString().slice(0, 10);
const plusMonths = (iso: string, months: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

const committedRows = (): UsgsGageRow[] =>
  existsSync(COMMITTED) ? (JSON.parse(readFileSync(COMMITTED, "utf8")) as UsgsGageRow[]) : [];

const committedEffectiveDate = (): string => {
  try {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
      datasets: Array<{ id: string; effectiveDate?: string }>;
    };
    return manifest.datasets.find((d) => d.id === "usgs-gages")?.effectiveDate ?? today();
  } catch {
    return today();
  }
};

async function load(): Promise<{ rows: UsgsGageRow[]; effectiveDate: string }> {
  try {
    const res = await fetch(NWIS_SITE_URL, { headers: { Accept: "text/plain" } });
    if (!res.ok) throw new Error(`NWIS site service HTTP ${res.status}`);
    const rows = toGageRows(parseRdb(await res.text())) as UsgsGageRow[];
    if (rows.length < MIN_SITES) throw new Error(`NWIS returned only ${rows.length} sites`);
    return { rows, effectiveDate: today() };
  } catch (err) {
    if (process.env.USGS_GAGES_REQUIRE_FETCH === "1") throw err;
    const kept = committedRows();
    if (kept.length === 0) throw err;
    console.warn(`  ! usgs-gages: ${(err as Error).message} — keeping the committed catalog (${kept.length} sites)`);
    return { rows: kept, effectiveDate: committedEffectiveDate() };
  }
}

const loaded = await load();
export const rows: UsgsGageRow[] = loaded.rows;
export const meta = {
  effectiveDate: loaded.effectiveDate,
  expiresDate: plusMonths(loaded.effectiveDate, 12),
};
