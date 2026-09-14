#!/usr/bin/env node
/**
 * @file check-gis-registry.mjs
 * @module engage-mt/scripts
 * @description GIS-linkage drift gate. The regs DB is tabular and links to live
 *              public FWP ESRI layers by key; the single source of truth for that
 *              map is shared/src/arcgisLayers.ts (ARCGIS_HD_LAYERS). This gate keeps
 *              the two independent consumers honest by static text comparison (no
 *              build needed):
 *                1. Every hunting-district layer id referenced in the web layer
 *                   registry (web/src/config/layers.ts `url:` fields) MUST exist as a
 *                   `district` entry in the shared registry — so a web repoint can't
 *                   silently diverge from the DB's linkage.
 *                2. Every key in the server seed's GIS_LAYER_SEED_KEYS MUST exist in
 *                   the shared registry — so a seed typo fails the build, not seeding.
 * See docs/rules/arcgis.md +.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT as ROOT } from "./sourceFiles.mjs";
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const registrySrc = read("shared/src/arcgisLayers.ts");
const webLayers = [
  "web/src/config/layers.ts",
  ...readdirSync(join(ROOT, "web/src/config/layers"))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => `web/src/config/layers/${f}`),
]
  .map(read)
  .join("\n");
const seedSrc = read("server/src/db/seed.ts");

const fail = (msg) => {
  console.error(`✗ gis-registry — ${msg}`);
  process.exit(1);
};

// --- registry facts ---------------------------------------------------------
// Allowed huntingDistricts sublayer ids for web layers.ts: district boundaries AND
// district portions (both are legitimate rendered/queried FWP sublayers modeled in
// the shared registry). Restricted-area sublayers are queried by services, not
// registered as web LayerDefs, so they're not included here.
const registryDistrictIds = new Set(
  registrySrc
    .split("\n")
    .filter((l) => /entityKind:\s*"(district|portion)"/.test(l))
    .map((l) => l.match(/layerId:\s*(\d+)/)?.[1])
    .filter(Boolean),
);
// All stable registry keys.
const registryKeys = new Set(
  [...registrySrc.matchAll(/\{\s*key:\s*"([^"]+)"/g)].map((m) => m[1]),
);

if (registryDistrictIds.size === 0 || registryKeys.size === 0) {
  fail("could not parse shared/src/arcgisLayers.ts — regex drift?");
}

// --- 1. web url ids ⊆ registry district ids ---------------------------------
const webIds = [
  ...webLayers.matchAll(/url:\s*"[^"]*huntingDistricts\/MapServer\/(\d+)"/g),
].map((m) => m[1]);
const unknownWebIds = [...new Set(webIds)].filter((id) => !registryDistrictIds.has(id));
if (unknownWebIds.length > 0) {
  fail(
    `web/src/config/layers.ts references huntingDistricts layer id(s) [${unknownWebIds.join(
      ", ",
    )}] absent from ARCGIS_HD_LAYERS. Add them to shared/src/arcgisLayers.ts.`,
  );
}

// --- 2. seed keys ⊆ registry keys -------------------------------------------
const seedArr = seedSrc.match(/GIS_LAYER_SEED_KEYS\s*=\s*\[([\s\S]*?)\]/);
if (!seedArr) fail("could not find GIS_LAYER_SEED_KEYS in server/src/db/seed.ts");
const seedKeys = [...seedArr[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const unknownSeedKeys = seedKeys.filter((k) => !registryKeys.has(k));
if (unknownSeedKeys.length > 0) {
  fail(
    `seed GIS_LAYER_SEED_KEYS has key(s) [${unknownSeedKeys.join(
      ", ",
    )}] absent from ARCGIS_HD_LAYERS.`,
  );
}

console.log(
  `✓ gis-registry — ${webIds.length} web district URLs + ${seedKeys.length} seed keys all resolve to ARCGIS_HD_LAYERS (${registryKeys.size} entries)`,
);
