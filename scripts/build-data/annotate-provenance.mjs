#!/usr/bin/env node
/**
 * @file annotate-provenance.mjs
 * @module engage-mt/scripts/build-data
 * @description Idempotent post-pass that stamps a `provenanceTier` on every
 *              dataset entry in `web/public/data/data-manifest.json`.
 *
 *              Why a standalone pass (not inline in build_all.mjs): running it
 *              last guarantees every entry is tiered no matter which script
 *              wrote it, without risking a clobber.
 *
 *              `build_all.mjs` ALSO stamps the entries it owns (via the shared
 *              classifier) so `npm run build:data` alone is already tiered;
 *              this pass is the belt-and-suspenders that covers any
 *              externally-appended entries.
 *
 *              Idempotent: re-running re-derives the same tier from each entry's
 *              `source`/`id`, so it's safe to run any number of times.
 *
 *              Usage:  node scripts/build-data/annotate-provenance.mjs
 *              Or:     npm run data:provenance --workspace web
 *
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-06-30
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { classifyProvenanceTier } from "./lib/provenanceTier.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const MANIFEST_PATH = resolve(REPO_ROOT, "web/public/data/data-manifest.json");

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
if (!Array.isArray(manifest.datasets)) {
  console.error("annotate-provenance: manifest has no `datasets` array.");
  process.exit(1);
}

const counts = { "demo-fixture": 0, extracted: 0, authoritative: 0 };

manifest.datasets = manifest.datasets.map((entry) => {
  const provenanceTier = classifyProvenanceTier(entry);
  counts[provenanceTier] = (counts[provenanceTier] ?? 0) + 1;
  // Re-insert with `provenanceTier` placed right after `source` for readability.
  const { provenanceTier: _drop, ...rest } = entry;
  return { ...rest, provenanceTier };
});

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");

console.log("✅ annotate-provenance — tiers stamped on", manifest.datasets.length, "datasets");
console.log(
  `   demo-fixture: ${counts["demo-fixture"]} · extracted: ${counts.extracted} · authoritative: ${counts.authoritative}`,
);
