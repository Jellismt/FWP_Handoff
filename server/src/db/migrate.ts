/**
 * @file migrate.ts
 * @module engage-mt/server/db
 * @description Dependency-free forward/backward migration runner over plain `.sql`
 *              files in src/db/migrations/. Each file has `-- Up Migration` and
 *              `-- Down Migration` sections; applied files are tracked in
 *              regs.schema_migrations. Plain SQL is deliberate: these files are the
 *              artifact handed to FWP DBAs for the Oracle port (no ORM DSL to unwind).
 *
 *              Usage: `tsx src/db/migrate.ts up` | `... down` (one step).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getPool, closePool } from "./pool.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "migrations");
const UP_MARKER = "-- Up Migration";
const DOWN_MARKER = "-- Down Migration";

interface Migration {
  name: string;
  up: string;
  down: string;
}

async function loadMigrations(): Promise<Migration[]> {
  // SKIP_POSTGIS=1 omits the geometry-sidecar migration on hosts without the
  // PostGIS extension (the spatial features degrade gracefully; see 0011 header).
  const skipPostgis = process.env.SKIP_POSTGIS === "1";
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => !(skipPostgis && f.includes("postgis")))
    .sort();
  const out: Migration[] = [];
  for (const file of files) {
    const raw = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    const upIdx = raw.indexOf(UP_MARKER);
    const downIdx = raw.indexOf(DOWN_MARKER);
    if (upIdx === -1) throw new Error(`${file}: missing "${UP_MARKER}" marker`);
    const up = raw.slice(upIdx + UP_MARKER.length, downIdx === -1 ? undefined : downIdx).trim();
    const down = downIdx === -1 ? "" : raw.slice(downIdx + DOWN_MARKER.length).trim();
    out.push({ name: file, up, down });
  }
  return out;
}

async function ensureTrackingTable(): Promise<void> {
  // The tracking table lives in its own bootstrap so `regs` exists before migration 1.
  await getPool().query(`CREATE SCHEMA IF NOT EXISTS regs`);
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS regs.schema_migrations (
      name        VARCHAR(200) PRIMARY KEY,
      applied_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function appliedSet(): Promise<Set<string>> {
  const res = await getPool().query<{ name: string }>(
    "SELECT name FROM regs.schema_migrations",
  );
  return new Set(res.rows.map((r) => r.name));
}

async function up(): Promise<void> {
  await ensureTrackingTable();
  const applied = await appliedSet();
  const migrations = await loadMigrations();
  let count = 0;
  for (const m of migrations) {
    if (applied.has(m.name)) continue;
    process.stdout.write(`↑ applying ${m.name} … `);
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(m.up);
      await client.query("INSERT INTO regs.schema_migrations (name) VALUES ($1)", [m.name]);
      await client.query("COMMIT");
      count += 1;
      process.stdout.write("done\n");
    } catch (err) {
      await client.query("ROLLBACK");
      process.stdout.write("FAILED\n");
      throw err;
    } finally {
      client.release();
    }
  }
  console.log(count === 0 ? "Already up to date." : `Applied ${count} migration(s).`);
}

async function down(): Promise<void> {
  await ensureTrackingTable();
  const applied = await appliedSet();
  const migrations = await loadMigrations();
  const last = [...migrations].reverse().find((m) => applied.has(m.name));
  if (!last) {
    console.log("Nothing to roll back.");
    return;
  }
  if (!last.down) throw new Error(`${last.name}: no down migration defined`);
  process.stdout.write(`↓ reverting ${last.name} … `);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(last.down);
    await client.query("DELETE FROM regs.schema_migrations WHERE name = $1", [last.name]);
    await client.query("COMMIT");
    process.stdout.write("done\n");
  } catch (err) {
    await client.query("ROLLBACK");
    process.stdout.write("FAILED\n");
    throw err;
  } finally {
    client.release();
  }
}

/** Programmatic entry (used by the test harness globalSetup). */
export async function migrateUp(): Promise<void> {
  await up();
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const cmd = process.argv[2] ?? "up";
  const run = cmd === "down" ? down : up;
  run()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      void closePool().finally(() => process.exit(1));
    });
}
