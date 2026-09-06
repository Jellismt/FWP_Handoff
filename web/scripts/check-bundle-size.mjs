#!/usr/bin/env node
/**
 * @file check-bundle-size.mjs
 * @module engage-mt/scripts
 * @description Bundle-size budget enforcement, run after `vite build` as part
 *              of `npm run verify`. Three gzip budgets: the app entry chunk
 *              (`index-*.js`, where feature bloat lands), the ArcGIS vendor
 *              chunk (`vendor-esri-*.js`, Calcite plus the map SDK's first-paint share),
 *              and the total of all JS in `dist/assets`.
 *
 *              Budget policy: set each budget a modest headroom above the
 *              measured gzip size of a clean build, then RATCHET DOWN whenever
 *              a code-split or dependency win shrinks a chunk — locking the win
 *              against regression. Raise only deliberately (a documented
 *              dependency bump or feature landing), never to quiet an
 *              accidental creep. Keep enough headroom that environment
 *              variance (another machine may measure a few KB heavier) can't
 *              red the gate on its own.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BUDGETS = {
  // App entry chunk. Measured 102 KB gzip.
  main_gzip_bytes: 130_000,
  // Calcite plus the ArcGIS modules the entry reaches statically. Measured 940 KB gzip.
  vendor_esri_gzip_bytes: 1_000_000,
  // Every JS chunk in dist/assets. Measured 4.15 MB gzip.
  total_gzip_bytes: 4_400_000,
};

const isMainChunk = (name) => /^index-[A-Za-z0-9_-]+\.js$/.test(name);
const isEsriVendorChunk = (name) => /^vendor-esri-[A-Za-z0-9_-]+\.js$/.test(name);

export function formatBytes(n) {
  if (n < 1000) return `${n} B`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)} KB`;
  return `${(n / 1_000_000).toFixed(2)} MB`;
}

/**
 * Evaluate gzip sizes (by chunk file name) against the budgets. Pure so the
 * budget rules are unit-testable. The largest `index-*.js` is the entry.
 */
export function evaluateBudgets(sizesByName, budgets = BUDGETS) {
  const report = [];
  const problems = [];
  let main = null;
  let arcgis = null;
  let total = 0;
  for (const [name, size] of Object.entries(sizesByName)) {
    total += size;
    if (isMainChunk(name) && (!main || size > main.size)) main = { name, size };
    if (isEsriVendorChunk(name) && (!arcgis || size > arcgis.size)) arcgis = { name, size };
  }
  const line = (label, entry, budget) => {
    if (!entry) {
      problems.push(`No ${label} chunk found in dist/assets.`);
      return;
    }
    report.push(
      `${label.padEnd(14)} ${entry.name}  ${formatBytes(entry.size)} gzip  (budget ${formatBytes(budget)})`,
    );
    if (entry.size > budget) {
      problems.push(`${label} over budget by ${formatBytes(entry.size - budget)}`);
    }
  };
  line("main chunk:", main, budgets.main_gzip_bytes);
  line("esri vendor:", arcgis, budgets.vendor_esri_gzip_bytes);
  report.push(`${"total js:".padEnd(14)} ${formatBytes(total)} gzip  (budget ${formatBytes(budgets.total_gzip_bytes)})`);
  if (total > budgets.total_gzip_bytes) {
    problems.push(`Total JS over budget by ${formatBytes(total - budgets.total_gzip_bytes)}`);
  }
  return { report, problems };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const distAssets = "dist/assets";
  try {
    statSync(distAssets);
  } catch {
    console.error(`No ${distAssets} directory — run \`vite build\` first.`);
    process.exit(2);
  }
  const sizes = {};
  for (const name of readdirSync(distAssets)) {
    if (name.endsWith(".js")) sizes[name] = gzipSync(readFileSync(join(distAssets, name))).length;
  }
  const { report, problems } = evaluateBudgets(sizes);
  console.log(report.join("\n"));
  if (problems.length > 0) {
    for (const p of problems) console.error(`❌ ${p}`);
    console.error("\nBundle-size budget violated. Code-split or trim a chunk, or — with");
    console.error("deliberation — raise the budget in web/scripts/check-bundle-size.mjs.");
    process.exit(1);
  }
  console.log("✅ Within bundle-size budget.");
}
