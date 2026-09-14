#!/usr/bin/env node
/**
 * @file check-regs-floor-age.mjs
 * @module engage-mt/scripts
 * @description Gate on the built-in regulations copy the app ships for offline
 *              use (`web/public/data/regs-snapshot.json`). Fails when the file
 *              is missing or unreadable, carries no `generatedAt` stamp, is
 *              older than REGS_FLOOR_MAX_DAYS (default 90), or its `validUntil`
 *              season boundary has passed. Refresh with
 *              `(cd web && npm run data:regs)` and commit the result.
 *              Wired into `npm run verify` and the mobile web build.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SNAPSHOT_PATH = resolve(__dirname, "..", "web", "public", "data", "regs-snapshot.json");
export const DEFAULT_MAX_DAYS = 90;
const REFRESH = "Refresh it with `(cd web && npm run data:regs)` and commit the result.";

/**
 * Evaluate a snapshot's freshness. Pure: takes the parsed JSON (or null when
 * unreadable) and "now", returns the problems found plus a one-line summary.
 */
export function evaluateRegsFloor(snapshot, now = new Date(), maxDays = DEFAULT_MAX_DAYS) {
  const problems = [];
  if (!snapshot || typeof snapshot !== "object") {
    return { problems: ["built-in regs copy is missing or unreadable"], summary: null };
  }
  const meta = snapshot["hunting-regulations-unified"]?.meta ?? {};
  const generatedAt = Date.parse(meta.generatedAt ?? "");
  if (Number.isNaN(generatedAt)) {
    return { problems: ["built-in regs copy has no generatedAt stamp"], summary: null };
  }
  const ageDays = Math.round((now.getTime() - generatedAt) / 86_400_000);
  if (ageDays > maxDays) {
    problems.push(`built-in regs copy is ${ageDays} days old (limit ${maxDays})`);
  }
  const validUntil = Date.parse(meta.validUntil ?? "");
  if (!Number.isNaN(validUntil) && validUntil < now.getTime()) {
    problems.push(`built-in regs copy expired on ${meta.validUntil} (season boundary passed)`);
  }
  const summary = `v${meta.version ?? "?"} · effective ${meta.effectiveDate ?? "?"} · valid until ${meta.validUntil ?? "?"} · ${ageDays} days old`;
  return { problems, summary };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const maxDays = Number(process.env.REGS_FLOOR_MAX_DAYS ?? DEFAULT_MAX_DAYS);
  let snapshot = null;
  if (existsSync(SNAPSHOT_PATH)) {
    try {
      snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
    } catch {
      snapshot = null;
    }
  }
  const { problems, summary } = evaluateRegsFloor(snapshot, new Date(), maxDays);
  if (problems.length > 0) {
    for (const p of problems) console.error(`❌ ${p}`);
    console.error(`   ${REFRESH}`);
    process.exit(1);
  }
  console.log(`✓ built-in regs copy: ${summary}`);
}
