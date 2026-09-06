/**
 * @file loadSunriseSunsetGrid.ts
 * @module engage-mt/server/etl
 * @description Populates the per-day sunrise/sunset time grid (book p.151) for the 4
 *              shooting-hour zones, Aug 1 → Feb 28. These are the **official** Commission-
 *              adopted tables, transcribed exactly from the printed p.151 via the PDF's text
 *              layer (`pdftotext -layout` → `sunrise-sunset-2026.json`, 848 rows), NOT computed
 *              — the printed table is the legal authority ("Do not use other sources"). The
 *              earlier NOAA-computed grid (which drifted up to ~30-50 min around the November
 *              DST transition) is retired. Legal hunting hours run one-half hour before sunrise
 *              to one-half hour after sunset; the app derives that from rise_min / set_min
 *              (minutes after midnight; Rise = A.M., Set = P.M.).
 *              Usage: `tsx src/etl/loadSunriseSunsetGrid.ts [year]`
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-07
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { withTransaction, closePool, query } from "../db/pool.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// [zone_no, month_no, day_no, rise_min, set_min] — official printed p.151 values.
interface OfficialGrid { rows: [number, number, number, number, number][] }

export async function loadSunriseSunsetGrid(seasonYear = Number(process.argv[2]) || 2026): Promise<void> {
  const data = JSON.parse(readFileSync(join(HERE, "sunrise-sunset-2026.json"), "utf8")) as OfficialGrid;
  const rows = data.rows;
  if (rows.length === 0) throw new Error("sunrise-sunset-2026.json is empty");

  let inserted = 0;
  await withTransaction("etl-ss-grid", async (c) => {
    const zoneIds = new Map<number, string>();
    for (const z of [1, 2, 3, 4]) {
      const id = (await c.query<{ id: string }>(
        `SELECT ss_zone_id AS id FROM regs.ss_zone WHERE season_year=$1 AND zone_no=$2`, [seasonYear, z])).rows[0]?.id;
      if (!id) throw new Error(`Zone ${z} missing — run etl:sunrise-sunset first.`);
      zoneIds.set(z, id);
      await c.query(`DELETE FROM regs.ss_time WHERE ss_zone_id=$1`, [id]);
    }
    for (const [zone, month, day, rise, set] of rows) {
      await c.query(
        `INSERT INTO regs.ss_time (ss_zone_id, month_no, day_no, rise_min, set_min) VALUES ($1,$2,$3,$4,$5)`,
        [zoneIds.get(zone), month, day, rise, set]);
      inserted++;
    }
  });
  const n = await query<{ n: string }>(
    `SELECT count(*) AS n FROM regs.ss_time st JOIN regs.ss_zone z ON z.ss_zone_id=st.ss_zone_id WHERE z.season_year=$1`, [seasonYear]);
  console.log(`Sunrise-sunset grid for ${seasonYear}: loaded ${inserted} OFFICIAL time rows (${n.rows[0]!.n} total, transcribed from printed p.151).`);
}

const isMain = process.argv[1]?.endsWith("loadSunriseSunsetGrid.ts") || process.argv[1]?.endsWith("loadSunriseSunsetGrid.js");
if (isMain) {
  loadSunriseSunsetGrid().then(() => closePool()).then(() => process.exit(0)).catch((e) => { console.error(e); void closePool().finally(() => process.exit(1)); });
}
