/**
 * @file syncPortions.ts
 * @module engage-mt/server/etl
 * @description GIS sync: pulls district-PORTION codes + names from FWP's authoritative,
 *              live public ArcGIS portion layers (Antelope /4, Mule Deer /12,
 *              White-tailed /13, Elk /14) into regs.district_portion (codes/names only —
 *              returnGeometry=false; geometry stays in ESRI, resolved client-side per
 *). Sibling of syncDistrictCodes.ts. portion_code = SHAPECODE
 *              (deterministically -n suffixed for the rare shared-shapecode half-pairs,
 *              e.g. mdPt388 WRA / Outside-WRA); portion_name = PORTIONNAME (the real,
 *              per-district-unique match key used by the re-key + tap resolver). Parent
 *              district resolved by (geography, DISTRICT): antelope → ANTELOPE_HD, deer/elk
 *              → HD. Unresolved parents are logged + skipped, never silent.
 *              Scope = deer/elk/antelope (the DEA book); moose/upland are separate booklets.
 *              Usage: `npm run etl:portions` (tsx src/etl/syncPortions.ts).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ARCGIS_HD_LAYERS, arcgisLayerUrl, type ArcgisLayerDef } from "@engage-mt/regs-shared";
import { withTransaction, closePool, query } from "../db/pool.js";

// The DEA book covers deer + elk + antelope; sync those portion layers only. The
// registry also carries moose/upland portions — out of scope until those booklets land.
const SCOPE_KEYS = new Set(["antelope-portion", "mule-deer-portion", "wtd-portion", "elk-portion"]);
const SYNC_LAYERS = ARCGIS_HD_LAYERS.filter((l) => l.entityKind === "portion" && SCOPE_KEYS.has(l.key));

/** A portion belongs to its parent HD; antelope portions parent onto the antelope roster. */
function parentGeography(layer: ArcgisLayerDef): string {
  return layer.speciesScope === "antelope" ? "ANTELOPE_HD" : "HD";
}

interface Feature {
  attributes: Record<string, unknown>;
}

/** Page an ArcGIS portion layer's attributes (no geometry). */
async function fetchPortions(url: string): Promise<Feature[]> {
  const out: Feature[] = [];
  let offset = 0;
  const page = 1000;
  for (;;) {
    const q =
      `${url}/query?where=1%3D1&outFields=DISTRICT,SHAPECODE,PORTIONNAME,COMMENTS` +
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

/**
 * Assign a per-district-unique portion_code from SHAPECODE. Almost every portion has a
 * unique (DISTRICT, SHAPECODE); the rare shared-shapecode half-pairs (mdPt388, mdPt312)
 * get a deterministic `-n` suffix ordered by PORTIONNAME so re-runs stay idempotent.
 * Keyed by PORTIONNAME (unique within a district) → portion_code.
 */
export function assignPortionCodes(feats: Feature[]): Map<string, string> {
  const groups = new Map<string, { name: string; code: string }[]>();
  for (const f of feats) {
    const district = str(f.attributes.DISTRICT);
    const shapecode = str(f.attributes.SHAPECODE);
    const name = str(f.attributes.PORTIONNAME);
    if (!district || !shapecode || !name) continue;
    const gk = `${district}|${shapecode}`;
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk)!.push({ name, code: shapecode });
  }
  const byName = new Map<string, string>();
  for (const [, members] of groups) {
    if (members.length === 1) {
      byName.set(members[0]!.name, members[0]!.code);
    } else {
      // Deterministic order → stable suffixes across re-runs.
      members.sort((a, b) => a.name.localeCompare(b.name));
      members.forEach((m, i) => byName.set(m.name, i === 0 ? m.code : `${m.code}-${i + 1}`));
    }
  }
  return byName;
}

export async function syncPortions(): Promise<void> {
  for (const layer of SYNC_LAYERS) {
    const geographyCode = parentGeography(layer);
    let feats: Feature[];
    try {
      feats = await fetchPortions(arcgisLayerUrl(layer));
    } catch (err) {
      console.warn(`  ! ${layer.key} (/${layer.layerId}) unreachable: ${String(err)} — skipping`);
      continue;
    }
    const codeByName = assignPortionCodes(feats);
    let added = 0;
    let updated = 0;
    let unresolved = 0;
    await withTransaction("gis-sync", async (c) => {
      for (const f of feats) {
        const districtCode = str(f.attributes.DISTRICT);
        const portionName = str(f.attributes.PORTIONNAME);
        const comments = str(f.attributes.COMMENTS);
        if (!districtCode || !portionName) continue;
        const portionCode = codeByName.get(portionName);
        if (!portionCode) continue;
        const parent = await c.query<{ id: string }>(
          `SELECT district_id AS id FROM regs.district WHERE geography_code=$1 AND district_code=$2`,
          [geographyCode, districtCode],
        );
        const districtId = parent.rows[0]?.id;
        if (!districtId) {
          unresolved += 1;
          console.warn(`    ? ${layer.key}: parent ${geographyCode} ${districtCode} not in regs.district — skipping "${portionName}"`);
          continue;
        }
        const up = await c.query<{ inserted: boolean }>(
          `INSERT INTO regs.district_portion (district_id, portion_code, portion_name, boundary_desc, has_geometry, updated_by)
           VALUES ($1,$2,$3,$4,1,'gis-sync')
           ON CONFLICT (district_id, portion_code) DO UPDATE
             SET portion_name = EXCLUDED.portion_name,
                 boundary_desc = EXCLUDED.boundary_desc,
                 has_geometry = 1,
                 updated_by = 'gis-sync',
                 updated_at = CURRENT_TIMESTAMP,
                 revision = regs.district_portion.revision + 1
           RETURNING (xmax = 0) AS inserted`,
          [districtId, portionCode, portionName, comments],
        );
        if (up.rows[0]?.inserted) added += 1;
        else updated += 1;
      }
    });
    console.log(`  ${layer.key} (/${layer.layerId}→${geographyCode}): ${feats.length} features → +${added} new, ${updated} updated, ${unresolved} unresolved`);
  }

  const total = await query<{ n: string }>(`SELECT count(*)::text AS n FROM regs.district_portion`);
  console.log(`── regs.district_portion total: ${total.rows[0]?.n ?? "0"} ──`);
}

const isMain = process.argv[1]?.endsWith("syncPortions.ts") || process.argv[1]?.endsWith("syncPortions.js");
if (isMain) {
  syncPortions()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      void closePool().finally(() => process.exit(1));
    });
}
