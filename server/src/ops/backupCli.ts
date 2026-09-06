/**
 * @file backupCli.ts
 * @module engage-mt/server/ops
 * @description `npm run db:backup -- [--out DIR] [--keep N]`: a custom-format
 *              `pg_dump` of the regs database into DIR (default ./backups),
 *              named by UTC timestamp, with its SHA-256 printed and older
 *              dumps rotated out beyond N (default 30). Warns when the local
 *              `pg_dump` major version is behind the server's. Needs
 *              `DATABASE_URL` and a `pg_dump` binary on PATH.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";
import { dumpFileName, parseMajorVersion, selectDumpsToDelete } from "./backup.js";

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const outDir = resolve(arg("--out", "backups"));
  const keep = Number(arg("--keep", "30"));
  mkdirSync(outDir, { recursive: true });

  const client = new pg.Client({ connectionString: url, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  const serverVersion = parseMajorVersion((await client.query("SHOW server_version")).rows[0]?.server_version ?? "");
  await client.end();
  const clientVersion = parseMajorVersion(execFileSync("pg_dump", ["--version"], { encoding: "utf8" }));
  if (serverVersion && clientVersion && clientVersion < serverVersion) {
    console.warn(`⚠️  pg_dump ${clientVersion} is older than the server (${serverVersion}); install a matching client (macOS: brew install libpq).`);
  }

  const file = join(outDir, dumpFileName(new Date()));
  const dump = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--file=${file}`, url], { stdio: "inherit" });
  if (dump.status !== 0) throw new Error(`pg_dump exited ${dump.status}`);
  const bytes = statSync(file).size;
  const sha = createHash("sha256").update(readFileSync(file)).digest("hex");
  console.log(`✓ ${file} (${(bytes / 1024).toFixed(0)} KB) sha256 ${sha}`);

  for (const old of selectDumpsToDelete(readdirSync(outDir), keep)) {
    rmSync(join(outDir, old));
    console.log(`  rotated out ${old}`);
  }
}

main().catch((err) => {
  console.error(`❌ ${(err as Error).message}`);
  process.exit(1);
});
