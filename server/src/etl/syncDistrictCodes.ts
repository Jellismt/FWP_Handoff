/**
 * @file syncDistrictCodes.ts
 * @module engage-mt/server/etl
 * @description GIS sync: pulls district CODES + region from FWP's authoritative,
 *              live public ArcGIS service into regs.district (codes only —
 *              returnGeometry=false; geometry stays in ESRI and is resolved
 *              client-side, addendum). Service URL + layer ids + the
 *              join key field come from the single-source shared registry
 *              (@engage-mt/regs-shared ARCGIS_HD_LAYERS), not hardcoded here. New
 *              codes are inserted with needs_review=1 (never silent) — this is how
 *              the ANTELOPE_HD geography gets populated. Prints an added/updated
 *              report. (Renamed from syncDistrictGeoms.ts — it never synced geometry.)
 *              Usage: `npm run sync:districts` (tsx src/etl/syncDistrictCodes.ts).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ARCGIS_DISTRICT_LAYERS, arcgisLayerUrl } from "@engage-mt/regs-shared";
import { withTransaction, closePool, query } from "../db/pool.js";

// The regs DB models deer/elk (HD) + antelope (ANTELOPE_HD) in v1; sync those
// district rosters from their live ESRI layers. When more species are added to
// the DB, extend this set (the registry already carries every species' layer).
const V1_GEOGRAPHIES = new Set(["HD", "ANTELOPE_HD"]);
const SYNC_LAYERS = ARCGIS_DISTRICT_LAYERS.filter(
  (l) => l.geographyCode != null && V1_GEOGRAPHIES.has(l.geographyCode),
);

interface Feature {
  attributes: Record<string, unknown>;
}

/** Page an ArcGIS FeatureLayer's attributes (no geometry). */
async function fetchDistricts(url: string, keyField: string): Promise<Feature[]> {
  const out: Feature[] = [];
  let offset = 0;
  const page = 1000;
  for (;;) {
    // These layers key on <keyField> (+ REG region). There is no NAME field on the
    // HD layers — district names come from the book/facts extract, not GIS. Requesting
    // a bad field returns zero features, so only ask for what exists.
    const q =
      `${url}/query?where=1%3D1&outFields=${encodeURIComponent(keyField)},REG` +
      `&returnGeometry=false&f=json&resultOffset=${offset}&resultRecordCount=${page}`;
    const res = await fetch(q, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`ArcGIS ${res.status} for ${url}`);
    const body = (await res.json()) as { features?: Feature[]; exceededTransferLimit?: boolean };
    const feats = body.features ?? [];
    out.push(...feats);
    if (feats.length < page && !body.exceededTransferLimit) break;
    offset += feats.length;
    if (feats.length === 0) break;
  }
  return out;
}

const str = (v: unknown): string | null => (v == null ? null : String(v).trim() || null);
/** Region 1–7 from the district-number prefix (1xx→1 … 7xx→7). */
function regionFromCode(code: string): number {
  const n = Number(code.replace(/[^\d]/g, "").charAt(0));
  return n >= 1 && n <= 7 ? n : 1;
}

export async function syncDistrictCodes(): Promise<void> {
  for (const layer of SYNC_LAYERS) {
    const geographyCode = layer.geographyCode as string;
    let feats: Feature[];
    try {
      feats = await fetchDistricts(arcgisLayerUrl(layer), layer.keyField);
    } catch (err) {
      console.warn(`  ! ${geographyCode} (/${layer.layerId}) unreachable: ${String(err)} — skipping`);
      continue;
    }
    let added = 0;
    let updated = 0;
    await withTransaction("gis-sync", async (c) => {
      for (const f of feats) {
        const code = str(f.attributes[layer.keyField]);
        if (!code) continue;
        // Prefer the layer's REG field for region; fall back to the code prefix.
        const regRaw = Number(str(f.attributes.REG) ?? "");
        const region = regRaw >= 1 && regRaw <= 7 ? regRaw : regionFromCode(code);
        const existing = await c.query<{ id: string }>(
          `SELECT district_id AS id FROM regs.district WHERE geography_code=$1 AND district_code=$2`,
          [geographyCode, code],
        );
        if (existing.rows[0]) {
          updated += 1;
        } else {
          await c.query(
            `INSERT INTO regs.district (geography_code, district_code, region_id, needs_review)
             VALUES ($1,$2,$3,1)`,
            [geographyCode, code, region],
          );
          added += 1;
        }
      }
    });
    console.log(`  ${geographyCode} (/${layer.layerId}): ${feats.length} features → +${added} new, ${updated} updated`);
  }

  const counts = await query<{ geography_code: string; n: string }>(
    `SELECT geography_code, count(*)::text AS n FROM regs.district GROUP BY geography_code ORDER BY geography_code`,
  );
  console.log("── district counts by geography ──");
  for (const r of counts.rows) console.log(`  ${r.geography_code}: ${r.n}`);
}

const isMain =
  process.argv[1]?.endsWith("syncDistrictCodes.ts") || process.argv[1]?.endsWith("syncDistrictCodes.js");
if (isMain) {
  syncDistrictCodes()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      void closePool().finally(() => process.exit(1));
    });
}
