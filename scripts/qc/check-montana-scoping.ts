#!/usr/bin/env node
/**
 * @file check-montana-scoping.ts
 * @module engage-mt/scripts
 * @description Montana-scoping gate. Engage MT serves Montana only, so every
 *              national / multi-state map layer must be bounded to the state —
 *              otherwise out-of-state data bleeds across the border (the
 *              wind-arrow bug). This gate turns the `docs/rules/arcgis.md`
 *              § Montana scoping convention into an enforced contract: any
 *              LayerDef whose `source` is `external-public` or
 *              `esri-living-atlas` MUST declare ONE of:
 *                · `definitionExpression` — server-side state filter (cheapest;
 *                   the service carries a state-coded field), OR
 *                · `montanaClip: 'feature'` — GPU-side featureEffect clip to the
 *                   Montana polygon (no state field; vector layer), OR
 *                · `montanaScopeNote` — documented reason it's bounded another
 *                   way (raster/VTL dimmed by the focus mask; a service that is
 *                   intrinsically within MT).
 *
 *              Exemptions (no declaration needed):
 *                · `*.mt.gov` services — Montana state GIS, statewide by nature.
 *                · Non-HTTP / curated / computed layers (empty or `local:` url
 *                   with no portalItem) — bundled MT catalogs / graticule.
 *                · `composite` UI-only rows — they own no data.
 *
 *              Run: `npm run check:montana-scoping` (wired into `verify`).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { LAYER_REGISTRY } from "../../web/src/config/layers";

/** Sources that pull national / multi-state data and therefore need scoping. */
const NATIONAL_SOURCES = new Set(["external-public", "esri-living-atlas"]);

/** True when the layer's service is a Montana state GIS host (statewide MT). */
const isMontanaHost = (url: string): boolean => {
  if (!url.startsWith("http")) return false;
  try {
    return /(^|\.)mt\.gov$/.test(new URL(url).host);
  } catch {
    return false;
  }
};

const offenders: string[] = [];

for (const def of LAYER_REGISTRY) {
  if (!NATIONAL_SOURCES.has(def.source)) continue;
  // Composite rows own no data; their children are checked on their own defs.
  if (def.composite) continue;
  // Curated / computed / bundled layers (empty or non-HTTP url, no portal item)
  // are inherently Montana — nothing is fetched from a national service.
  if (!def.url.startsWith("http") && !def.portalItemId) continue;
  // Montana state GIS services are statewide-MT at the service level.
  if (isMontanaHost(def.url)) continue;

  const scoped =
    Boolean(def.definitionExpression) ||
    Boolean(def.montanaClip) ||
    Boolean(def.montanaScopeNote);
  if (!scoped) offenders.push(`${def.id}  (${def.source})`);
}

if (offenders.length > 0) {
  console.error(`✗ montana-scoping — ${offenders.length} national layer(s) with no Montana scope:`);
  for (const o of offenders) console.error(`    ${o}`);
  console.error(
    "  Declare definitionExpression (state field), montanaClip: 'feature' (vector clip),",
  );
  console.error(
    "  or montanaScopeNote (documented reason). See docs/rules/arcgis.md § Montana scoping.",
  );
  process.exit(1);
}

console.log(
  `✓ montana-scoping — every national layer is Montana-scoped (${LAYER_REGISTRY.length} defs checked)`,
);
