/**
 * @file restoreRehearsalCli.ts
 * @module engage-mt/server/ops
 * @description `npm run db:restore-rehearsal -- <dump> [--drop]`: proves a
 *              backup restores. Restores the dump into SCRATCH_DATABASE_URL
 *              (never the production URL — refused), optionally dropping and
 *              recreating that scratch database first, then counts the tables
 *              that matter and exits non-zero if the restore failed or the
 *              published regulations came back empty.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import pg from "pg";
import { assertScratchIsNotProduction, databaseName, deriveMaintenanceUrl } from "./backup.js";

const COUNTED = ["regs.published_regulations", "regs.publication", "regs.audit_log", "regs.staff_user"] as const;

async function main(): Promise<void> {
  const dump = process.argv.find((a) => a.endsWith(".dump"));
  if (!dump || !existsSync(dump)) throw new Error("pass the path to a regs-*.dump file");
  const scratch = process.env.SCRATCH_DATABASE_URL;
  if (!scratch) throw new Error("SCRATCH_DATABASE_URL is required (an empty database that is NOT production)");
  assertScratchIsNotProduction(scratch, process.env.DATABASE_URL);

  if (process.argv.includes("--drop")) {
    const name = databaseName(scratch);
    const maint = new pg.Client({ connectionString: deriveMaintenanceUrl(scratch) });
    await maint.connect();
    await maint.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await maint.query(`CREATE DATABASE "${name}"`);
    await maint.end();
    console.log(`✓ recreated ${name}`);
  }

  const restore = spawnSync("pg_restore", ["--no-owner", "--no-privileges", `--dbname=${scratch}`, dump], { stdio: "inherit" });
  if (restore.status !== 0) throw new Error(`pg_restore exited ${restore.status}`);

  const client = new pg.Client({ connectionString: scratch });
  await client.connect();
  let failed = false;
  for (const table of COUNTED) {
    const n = Number((await client.query(`SELECT count(*) AS n FROM ${table}`)).rows[0]?.n ?? 0);
    console.log(`  ${table.padEnd(30)} ${n}`);
    if (table === "regs.published_regulations" && n === 0) failed = true;
  }
  await client.end();
  if (failed) throw new Error("restore produced zero published regulations — the dump is not usable");
  console.log("✓ restore rehearsal passed");
}

main().catch((err) => {
  console.error(`❌ ${(err as Error).message}`);
  process.exit(1);
});
