#!/usr/bin/env node
/**
 * @file verify-gis-layers.mjs
 * @module engage-mt/server
 * @description Live probe of the FWP ESRI hunting-district layers the tabular regs
 *              DB links to. For every entry in the shared registry (ARCGIS_HD_LAYERS)
 *              it fetches `<service>/<layerId>?f=json` and asserts: HTTP 200, the
 *              layer name matches the recorded displayName, and the join keyField
 *              (+ subKeyField) exists in the live field list. This is how a future
 *              FWP layer renumber / field rename gets caught instead of silently
 *              404-ing. NOT part of `npm run verify` (it hits an external host);
 *              run manually or on a schedule: `npm run verify:gis` (from server/).
 *              Entries flagged schema_probed=false in the registry get their keyField
 *              confirmed here — promote them in arcgisLayers.ts once green.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ARCGIS_HD_LAYERS, arcgisLayerUrl } from "@engage-mt/regs-shared";

const TIMEOUT_MS = 15_000;

async function probe(def) {
  const url = `${arcgisLayerUrl(def)}?f=json`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctl.signal });
    if (!res.ok) return { def, ok: false, why: `HTTP ${res.status}` };
    const body = await res.json();
    if (body.error) return { def, ok: false, why: `service error ${JSON.stringify(body.error)}` };
    const fields = new Set((body.fields ?? []).map((f) => f.name));
    const problems = [];
    if (!body.name || !String(body.name).includes(def.displayName.split(" ")[0])) {
      problems.push(`name "${body.name}" ≠ "${def.displayName}"`);
    }
    if (!fields.has(def.keyField)) problems.push(`keyField "${def.keyField}" absent`);
    if (def.subKeyField && !fields.has(def.subKeyField)) {
      problems.push(`subKeyField "${def.subKeyField}" absent`);
    }
    return { def, ok: problems.length === 0, why: problems.join("; "), name: body.name };
  } catch (err) {
    return { def, ok: false, why: String(err?.message ?? err) };
  } finally {
    clearTimeout(t);
  }
}

const results = [];
for (const def of ARCGIS_HD_LAYERS) {
  // Sequential to be gentle on the FWP service.
  results.push(await probe(def));
}

let failed = 0;
for (const r of results) {
  const flag = r.ok ? "✓" : "✗";
  const probedNote = r.ok && !r.def.schemaProbed ? "  (schema now CONFIRMED — promote schemaProbed:true)" : "";
  console.log(`${flag} /${String(r.def.layerId).padStart(2)} ${r.def.key.padEnd(20)} ${r.ok ? r.name : r.why}${probedNote}`);
  if (!r.ok) failed += 1;
}

console.log(`\n${results.length - failed}/${results.length} layers live + correctly keyed.`);
process.exit(failed > 0 ? 1 : 0);
