/**
 * @file provenanceTier.mjs
 * @module engage-mt/build-data
 * @description Classifies a bundled dataset's provenance for the manifest.
 *              A dataset is `extracted` only when its source names an
 *              authoritative upstream (FWP, USGS, MSDI, DNRC, BLM, USFS);
 *              anything else is `demo-fixture`. A dataset entry may set the
 *              tier explicitly.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export const PROVENANCE_TIERS = Object.freeze(["demo-fixture", "extracted", "authoritative"]);

const AUTHORITATIVE_UPSTREAM = /\b(FWP|FWP-GIS|USGS|NWIS|MSDI|DNRC|BLM|USFS|NRCS|NOAA)\b/;
const DEMO_SIGNAL = /\bsample fixture\b|\bstub mirror\b|\bprovisional\b|\bplaceholder\b/i;

export function classifyProvenanceTier(entry = {}) {
  const { source, provenanceTier } = entry;
  if (provenanceTier) {
    if (!PROVENANCE_TIERS.includes(provenanceTier)) {
      throw new Error(`Unknown provenanceTier "${provenanceTier}"`);
    }
    return provenanceTier;
  }
  const s = String(source ?? "");
  if (DEMO_SIGNAL.test(s)) return "demo-fixture";
  return AUTHORITATIVE_UPSTREAM.test(s) ? "extracted" : "demo-fixture";
}
