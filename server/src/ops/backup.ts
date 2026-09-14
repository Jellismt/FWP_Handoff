/**
 * @file backup.ts
 * @module engage-mt/server/ops
 * @description Pure helpers behind the `db:backup` and `db:restore-rehearsal`
 *              commands: dump naming, rotation, maintenance-database URL
 *              derivation, and the client/server version comparison that
 *              decides whether a local `pg_dump` can talk to the server.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** `regs-YYYYMMDD-HHMM.dump` in UTC. */
export function dumpFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `regs-${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}.dump`;
}

/** Dumps beyond the newest `keep` (by name, which sorts by time) are returned for deletion. */
export function selectDumpsToDelete(names: readonly string[], keep: number): string[] {
  const dumps = names.filter((n) => /^regs-\d{8}-\d{4}\.dump$/.test(n)).sort();
  return keep >= dumps.length ? [] : dumps.slice(0, dumps.length - keep);
}

/** Same server, the `postgres` maintenance database (for CREATE/DROP DATABASE). */
export function deriveMaintenanceUrl(url: string): string {
  return url.replace(/\/[^/?]+(\?.*)?$/, "/postgres$1");
}

/** Database name from a connection URL. */
export function databaseName(url: string): string {
  return url.slice(url.lastIndexOf("/") + 1).replace(/\?.*$/, "");
}

/** Major version from `pg_dump (PostgreSQL) 16.4` or `SHOW server_version` → `18.1`. */
export function parseMajorVersion(text: string): number | null {
  const m = /(\d+)(?:\.\d+)*/.exec(text);
  return m ? Number(m[1]) : null;
}

/** A rehearsal must never target the production database. */
export function assertScratchIsNotProduction(scratchUrl: string, productionUrl: string | undefined): void {
  if (productionUrl && scratchUrl.trim() === productionUrl.trim()) {
    throw new Error("SCRATCH_DATABASE_URL must not be the production DATABASE_URL");
  }
}
