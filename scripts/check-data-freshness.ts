#!/usr/bin/env node
/**
 * @file check-data-freshness.ts
 * @module engage-mt/scripts
 * @description Verify-gate check: every Tier-2 dataset registered in
 *              the public data manifest has an `effectiveDate` within
 *              the past 12 months and a matching content hash, so a
 *              stale or hand-edited dataset cannot ship by accident.
 *
 *              Part of `npm run verify`; also runnable alone:
 *                npm run check:data-freshness
 *
 *              Exit codes:
 *                0 — all datasets fresh
 *                1 — at least one stale dataset
 *                2 — manifest missing or malformed
 *
 *              The manifest path defaults to
 *              `web/public/data/data-manifest.json` — override with
 *              the `MANIFEST_PATH` env var.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-05-31
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { createHash } from "node:crypto";

interface ManifestEntry {
  id: string;
  schemaVersion?: number | string;
  version?: number | string;
  effectiveDate?: string;
  source?: string;
  url?: string;
  // Manifest sha256 + file path are verified against
  // the bytes on disk so a hand-edited or accidentally-overwritten
  // dataset can't slip past the freshness gate.
  file?: string;
  sha256?: string;
}

interface Manifest {
  datasets?: ManifestEntry[];
  data?: ManifestEntry[];
  entries?: ManifestEntry[];
}

const MAX_AGE_MONTHS = 12;
const NOW = new Date();
const MAX_AGE_MS = MAX_AGE_MONTHS * 30 * 24 * 60 * 60 * 1000;

const manifestPath = resolve(
  process.env.MANIFEST_PATH ??
    "web/public/data/data-manifest.json",
);

const main = async (): Promise<number> => {
  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (err) {
    console.error(
      `check-data-freshness: cannot read manifest at ${manifestPath}`,
    );
    console.error(err instanceof Error ? err.message : String(err));
    return 2;
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(raw) as Manifest;
  } catch (err) {
    console.error("check-data-freshness: manifest is not valid JSON");
    console.error(err instanceof Error ? err.message : String(err));
    return 2;
  }

  const entries = manifest.datasets ?? manifest.data ?? manifest.entries ?? [];
  if (!Array.isArray(entries) || entries.length === 0) {
    console.warn(
      "check-data-freshness: no datasets in manifest — skipping (this is unusual; verify manifest path).",
    );
    return 0;
  }

  let staleCount = 0;
  let undatedCount = 0;
  let hashFailCount = 0;
  const tooOld: string[] = [];
  const undated: string[] = [];
  const hashFails: string[] = [];

  // Manifest `file` fields are rooted at the web app's public path
  // (e.g. "/data/boat-camps-2026.json"). The manifest lives at
  // <root>/data/data-manifest.json, so `dirname(manifestPath)` is the
  // `/data/` directory; the public root is one level up.
  const publicRoot = dirname(dirname(manifestPath));
  const resolveDataPath = (rel: string): string =>
    join(publicRoot, rel.replace(/^\//, ""));

  for (const entry of entries) {
    if (!entry.effectiveDate) {
      undatedCount += 1;
      undated.push(entry.id);
      continue;
    }
    const eff = Date.parse(entry.effectiveDate);
    if (Number.isNaN(eff)) {
      undatedCount += 1;
      undated.push(`${entry.id} (unparseable date: ${entry.effectiveDate})`);
      continue;
    }
    const ageMs = NOW.getTime() - eff;
    if (ageMs > MAX_AGE_MS) {
      staleCount += 1;
      const ageMonths = Math.round((ageMs / (30 * 24 * 60 * 60 * 1000)) * 10) / 10;
      tooOld.push(`${entry.id} (${ageMonths} months old, effective ${entry.effectiveDate})`);
    }

    // sha256 verification. Only checked when BOTH `file`
    // and `sha256` are declared so older entries without checksums
    // continue to pass.
    if (entry.file && entry.sha256) {
      try {
        const bytes = await readFile(resolveDataPath(entry.file));
        const actual = createHash("sha256").update(bytes).digest("hex");
        if (actual.toLowerCase() !== entry.sha256.toLowerCase()) {
          hashFailCount += 1;
          hashFails.push(
            `${entry.id} (file ${entry.file} — declared ${entry.sha256.slice(0, 12)}…, actual ${actual.slice(0, 12)}…)`,
          );
        }
      } catch (err) {
        hashFailCount += 1;
        hashFails.push(
          `${entry.id} (could not read ${entry.file}: ${err instanceof Error ? err.message : String(err)})`,
        );
      }
    }
  }

  console.log(
    `check-data-freshness: ${entries.length} datasets · ${staleCount} stale · ${undatedCount} undated · ${hashFailCount} sha256 mismatched`,
  );

  if (undated.length > 0) {
    console.warn("Datasets without effectiveDate:");
    for (const id of undated) console.warn(`  - ${id}`);
  }

  if (tooOld.length > 0) {
    console.error(
      `Datasets older than ${MAX_AGE_MONTHS} months — refresh required:`,
    );
    for (const id of tooOld) console.error(`  - ${id}`);
  }

  if (hashFails.length > 0) {
    console.error("Datasets failing sha256 verification:");
    for (const id of hashFails) console.error(`  - ${id}`);
  }

  if (tooOld.length > 0 || hashFails.length > 0) return 1;
  return 0;
};

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error("check-data-freshness: unexpected error");
    console.error(err);
    process.exit(2);
  },
);
