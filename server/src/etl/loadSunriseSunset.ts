/**
 * @file loadSunriseSunset.ts
 * @module engage-mt/server/etl
 * @description Seeds the 4 sunrise-sunset shooting-hour ZONES + their county lists
 *              (book p.151). The per-day time grid (~856 rows, commission-adopted legal
 *              times) is a separate extraction pass — the printed table is the legal
 *              authority, so it must be transcribed/extracted, not computed. This gives
 *              the zone→county structure the printed regs book's shooting-hours table needs.
 *              Usage: `tsx src/etl/loadSunriseSunset.ts [year]`
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { withTransaction, closePool, query } from "../db/pool.js";

const ZONES: [number, string, string[]][] = [
  [
    1,
    "Zone 1",
    [
      "Flathead",
      "Granite",
      "Lake",
      "Lincoln",
      "Mineral",
      "Missoula",
      "Ravalli",
      "Sanders",
    ],
  ],
  [
    2,
    "Zone 2",
    [
      "Beaverhead",
      "Broadwater",
      "Cascade",
      "Choteau",
      "Deer Lodge",
      "Gallatin",
      "Jefferson",
      "Lewis & Clark",
      "Liberty",
      "Madison",
      "Meagher",
      "Park",
      "Pondera",
      "Powell",
      "Silver Bow",
      "Teton",
      "Toole",
    ],
  ],
  [
    3,
    "Zone 3",
    [
      "Big Horn",
      "Blaine",
      "Carbon",
      "Fergus",
      "Golden Valley",
      "Judith Basin",
      "Musselshell",
      "Petroleum",
      "Phillips",
      "Stillwater",
      "Sweet Grass",
      "Wheatland",
      "Yellowstone",
    ],
  ],
  [
    4,
    "Zone 4",
    [
      "Carter",
      "Custer",
      "Daniels",
      "Dawson",
      "Fallon",
      "Garfield",
      "McCone",
      "Powder River",
      "Prairie",
      "Richland",
      "Roosevelt",
      "Rosebud",
      "Sheridan",
      "Treasure",
      "Valley",
      "Wibaux",
    ],
  ],
];

export async function loadSunriseSunset(
  seasonYear = Number(process.argv[2]) || 2026,
): Promise<void> {
  await withTransaction("etl-ss", async (c) => {
    for (const [zoneNo, zoneName, counties] of ZONES) {
      const existing = await c.query<{ id: string }>(
        `SELECT ss_zone_id AS id FROM regs.ss_zone WHERE season_year=$1 AND zone_no=$2`,
        [seasonYear, zoneNo],
      );
      let zoneId = existing.rows[0]?.id;
      if (!zoneId) {
        const r = await c.query<{ id: string }>(
          `INSERT INTO regs.ss_zone (season_year, zone_no, zone_name) VALUES ($1,$2,$3) RETURNING ss_zone_id AS id`,
          [seasonYear, zoneNo, zoneName],
        );
        zoneId = r.rows[0]!.id;
      }
      await c.query(`DELETE FROM regs.ss_zone_county WHERE ss_zone_id=$1`, [
        zoneId,
      ]);
      for (const county of counties)
        await c.query(
          `INSERT INTO regs.ss_zone_county (ss_zone_id, county_name) VALUES ($1,$2)`,
          [zoneId, county],
        );
    }
  });
  const z = await query<{ n: string }>(
    `SELECT count(*) AS n FROM regs.ss_zone WHERE season_year=$1`,
    [seasonYear],
  );
  const cty = await query<{ n: string }>(
    `SELECT count(*) AS n FROM regs.ss_zone_county sc JOIN regs.ss_zone z ON z.ss_zone_id=sc.ss_zone_id WHERE z.season_year=$1`,
    [seasonYear],
  );
  console.log(
    `Sunrise-sunset seed for ${seasonYear}: ${z.rows[0]!.n} zones, ${cty.rows[0]!.n} counties (time grid pending extraction).`,
  );
}

const isMain =
  process.argv[1]?.endsWith("loadSunriseSunset.ts") ||
  process.argv[1]?.endsWith("loadSunriseSunset.js");
if (isMain) {
  loadSunriseSunset()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      void closePool().finally(() => process.exit(1));
    });
}
