#!/usr/bin/env node
/**
 * @file build_all.mjs
 * @module engage-mt/scripts/build-data
 * @description Build orchestrator. Imports each *.source.ts, writes the
 *              dataset JSON to web/public/data/, then regenerates
 *              the data manifest with accurate row counts + byte sizes. Fails the
 * Build if any dataset exceeds the budget (6 MB total).
 *
 *              Every manifest entry now carries a `sha256`
 *              integrity hash so the runtime can detect tampered /
 *              stale-cached datasets at load time. Manifest schema
 *              version bumped to 1.1. The hash is hex-encoded SHA-256
 *              over the dataset file's raw bytes.
 *
 *              Re-run cadence: every commit that touches a *.source.ts
 *              file. `web/public/data/*` is git-tracked output so the
 *              hash diff lands in the same commit as the data update.
 *
 *              Usage:  node scripts/build-data/build_all.mjs
 *              Or:     npm run build:data --workspace web
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-06-01
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import {
  writeFileSync,
  readFileSync,
  statSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { classifyProvenanceTier } from "./lib/provenanceTier.mjs";

/**
 * SHA-256 of the file at `path`. Returns the lower-case hex
 * digest. Used to populate manifest integrity hashes so the runtime
 * can warn on mismatched / stale-cached payloads.
 */
const sha256File = (path) => {
  const buf = readFileSync(path);
  return createHash("sha256").update(buf).digest("hex");
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");
const OUT_DIR = resolve(REPO_ROOT, "web/public/data");

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const MANIFEST_VERSION = "2026.5-dev";
const PERF_009_BUDGET_BYTES = 6_000_000;

/**
 * Each entry maps a source file to its destination + manifest metadata.
 * Add a new dataset by appending an entry here and creating
 * scripts/build-data/sources/<name>.source.ts that exports `rows`.
 */
const DATASETS = [
  {
    id: "hunting-district-facts",
    sourceFile: "sources/hunting-district-facts.source.ts",
    outFile: "hunting-district-facts.json",
    // 3.1 — restored the authoritative weapon-restriction-area flag as the
    // dedicated boolean `weapon_restriction` (the general-season weapon windows
    // stay live from the Regs Manager). 3.0 dropped the provisional season +
    // free-text weapon columns; remaining facts are FWP-GIS-authoritative.
    // (2.0 dropped fabricated public_share_pct + top_access, added counties.)
    schemaVersion: "3.2",
    effectiveDate: "2026-04-01",
    expiresDate: "2027-03-31",
    source: `FWP Wildlife — 139 big-game districts; names, acreage, counties, region + weapon-restriction-area flag authoritative (FWP-GIS + per-district legal descriptions)`,
    license: "Public domain",
  },
  {
    id: "usgs-gages",
    sourceFile: "sources/usgs-gages.source.ts",
    outFile: "usgs-gages.json",
    schemaVersion: "1.0",
    // effectiveDate / expiresDate come from the source (the fetch date, or the
    // committed catalog's date when the service was unreachable).
    source: "USGS NWIS Site Service — active Montana stream gages reporting instantaneous discharge",
    license: "Public domain",
    upstreamUrl: "https://waterservices.usgs.gov/",
  },
];

const importTs = async (relativePath) => {
  // Dynamic import of a .ts source module. Run under
  // `node --experimental-strip-types` (see web/package.json build:data) so
  // TypeScript imports work in Node without a separate compile step.
  const absPath = resolve(__dirname, relativePath);
  const url = `file://${absPath}`;
  return await import(url);
};

const writeDataset = (file, rows) => {
  const path = resolve(OUT_DIR, file);
  // Pretty-print so git diffs stay friendly.
  writeFileSync(path, JSON.stringify(rows, null, 2));
  const stat = statSync(path);
  return { rowCount: rows.length, sizeBytes: stat.size };
};

let totalBytes = 0;
const manifestEntries = [];

console.log(`▶ build-data — manifest version ${MANIFEST_VERSION}\n`);

for (const ds of DATASETS) {
  try {
    const mod = await importTs(ds.sourceFile);
    if (!Array.isArray(mod.rows)) {
      throw new Error(`Source ${ds.sourceFile} did not export a 'rows' array.`);
    }
    const { rowCount, sizeBytes } = writeDataset(ds.outFile, mod.rows);
    const sha256 = sha256File(resolve(OUT_DIR, ds.outFile));
    totalBytes += sizeBytes;
    const effectiveDate = mod.meta?.effectiveDate ?? ds.effectiveDate;
    const expiresDate = mod.meta?.expiresDate ?? ds.expiresDate;
    if (!effectiveDate) throw new Error(`Dataset ${ds.id} has no effectiveDate`);
    manifestEntries.push({
      id: ds.id,
      file: `/data/${ds.outFile}`,
      format: "json",
      schemaVersion: ds.schemaVersion ?? "1.0",
      effectiveDate,
      ...(expiresDate ? { expiresDate } : {}),
      rowCount,
      sizeBytes,
      sha256,
      source: ds.source,
      provenanceTier: classifyProvenanceTier(ds),
      license: ds.license,
      ...(ds.upstreamUrl ? { upstreamUrl: ds.upstreamUrl } : {}),
    });
    console.log(
      `  ✓ ${ds.id.padEnd(28)} ${String(rowCount).padStart(5)} rows · ${String(sizeBytes).padStart(8)} B`,
    );
  } catch (err) {
    console.error(`  ✗ ${ds.id}: ${err.message}`);
    process.exit(1);
  }
}

if (totalBytes > PERF_009_BUDGET_BYTES) {
  console.error(
    `\n❌ Total payload ${totalBytes} B exceeds PERF-009 budget ${PERF_009_BUDGET_BYTES} B.`,
  );
  process.exit(1);
}

const manifest = {
  version: MANIFEST_VERSION,
  generatedAt: new Date().toISOString(),
  // Schema bumped to 1.1 with the addition of `sha256` per
  // dataset entry. Runtime manifest loader checks the major.minor and
  // logs a warning when the schema version on disk diverges from the
  // version it knows how to validate. 1.2 allows per-dataset schemaVersion
  // strings beyond "1.0"; the field signals shape contracts to
  // component-side SQL.
  manifestSchemaVersion: "1.2",
  appVersion: "1.0.0",
  datasets: manifestEntries,
};

writeFileSync(
  resolve(OUT_DIR, "data-manifest.json"),
  JSON.stringify(manifest, null, 2),
);

console.log(`\n✅ build-data complete`);
console.log(
  `   ${manifestEntries.length} datasets · ${totalBytes.toLocaleString()} B / ${PERF_009_BUDGET_BYTES.toLocaleString()} B (PERF-009)`,
);
