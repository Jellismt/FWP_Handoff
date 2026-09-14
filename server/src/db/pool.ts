/**
 * @file pool.ts
 * @module engage-mt/server/db
 * @description The single pg connection pool + a `withTransaction` helper that also
 *              sets `app.user` (SET LOCAL) so the audit triggers attribute the change.
 *              All queries route through here — one place to add Oracle-era swaps later.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import pg from "pg";
import { loadConfig, type AppConfig } from "../config.js";

/**
 * Translate DATABASE_SSL (with an env-aware default) into pg's `ssl` option.
 * Production defaults to `require` so connections are encrypted even if the
 * operator forgets to set the var; dev/test/CI + Railway's private network
 * default to `off`. `verify` needs a CA the client already trusts — set the
 * var explicitly (and supply a CA) only where the cert chain is verifiable.
 */
function resolveSsl(cfg: AppConfig): pg.PoolConfig["ssl"] {
  const mode = cfg.DATABASE_SSL ?? (cfg.NODE_ENV === "production" ? "require" : "off");
  if (mode === "off") return undefined;
  if (mode === "verify") return { rejectUnauthorized: true };
  return { rejectUnauthorized: false }; // "require": encrypt, don't verify chain
}

// Postgres NUMERIC/BIGINT come back as strings by default; keep BIGINT as string
// (ids are opaque) but parse INT/SMALLINT (OID 20 is int8 → leave string; 23=int4).
// We deliberately do NOT globally coerce int8 to Number to avoid precision loss.

let pool: pg.Pool | null = null;

/** Lazily create the shared pool from DATABASE_URL. */
export function getPool(): pg.Pool {
  if (!pool) {
    const cfg = loadConfig();
    pool = new pg.Pool({
      connectionString: cfg.DATABASE_URL,
      ssl: resolveSsl(cfg),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // Pin every connection to UTC via the startup packet so `to_char(ts, '…Z')`
      // renders TRUE UTC. Otherwise it formats in the server's local zone but appends
      // a literal "Z", and the optimistic-lock comparison (which re-parses that string
      // as UTC) is off by the offset → spurious 409s. Deterministic across
      // dev/CI/Railway/AWS regardless of container timezone.
      options: "-c timezone=UTC",
    });
  }
  return pool;
}

/** Close the pool (test teardown / graceful shutdown). */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export type QueryParams = ReadonlyArray<unknown>;

/** Run a one-off parameterized query on the pool. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: QueryParams,
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[]);
}

/**
 * Run `fn` inside a transaction. `actingUser` is stamped via `SET LOCAL app.user`
 * so the audit triggers record who made the change (Oracle: SYS_CONTEXT client id).
 */
export async function withTransaction<T>(
  actingUser: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // set_config(param, value, is_local=true) — scoped to this transaction.
    await client.query("SELECT set_config('app.user', $1, true)", [actingUser]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
