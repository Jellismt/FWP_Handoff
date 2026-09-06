/**
 * @file loadPamphletAssets.ts
 * @module engage-mt/server/etl
 * @description Registers the remaining book map/figure inventory as PLACEHOLDER CMS assets
 *              (loadRegionMaps already covers the 7 deer/elk region plates): the per-region
 *              antelope district maps (pp.128-134, ANTELOPE_HD geography, regions 2-7), the
 *              cover, and the book's figures — statewide deer/elk + antelope maps, the CWD
 *              sample map (p.4), the bear-distribution map (p.47), the region-numbering figure
 *              (p.7), the species-ID figure (p.9), and the bonus-point chart (p.45). Figures
 *              are linked to their content section via content_asset where one exists. Until
 *              FWP wires the real Bloomreach maps (STUB-035) the CmsProvider stub renders a
 *              deterministic placeholder per cms_doc_id. Idempotent per cms_doc_id. Loads DRAFT.
 *              Usage: `tsx src/etl/loadPamphletAssets.ts [year]` (default 2026).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { PoolClient } from "pg";
import { withTransaction, closePool, query } from "../db/pool.js";

// Antelope has districts in regions 2-7 (region 1 has no antelope HDs in the 2026 book).
const ANTELOPE_REGIONS = [2, 3, 4, 5, 6, 7] as const;

// FIGURE/COVER assets: cms_doc_id suffix, asset_kind, title, alt, source_page, linkedContentSlug|null
type Figure = [string, string, string, string, number, string | null];
const FIGURES: Figure[] = [
  ["cover", "COVER", "2026 Deer • Elk • Antelope Cover", "Cover of the 2026 Montana FWP Deer, Elk & Antelope hunting regulations", 1, null],
  ["statewide-deer-elk-map", "REGION_MAP", "Statewide Deer & Elk District Map", "Statewide map of all Montana deer and elk hunting districts", 32, null],
  ["statewide-antelope-map", "REGION_MAP", "Statewide Antelope District Map", "Statewide map of all Montana antelope hunting districts", 128, null],
  ["cwd-sample-map", "FIGURE", "CWD Sample Collection Map", "Map of chronic-wasting-disease samples collected across Montana with the 2026/2027 hunting districts", 4, "cwd-where"],
  ["bear-distribution-map", "FIGURE", "General Bear Distribution in Montana", "Map showing grizzly and black bear distribution across Montana", 47, "bear-identification"],
  ["region-numbering-figure", "FIGURE", "FWP Region Numbering", "Figure of Montana's seven FWP administrative regions", 7, "how-to-use"],
  ["species-id-figure", "FIGURE", "Antelope, Deer & Elk Identification Guide", "Illustrations distinguishing antelope, mule deer, white-tailed deer, and elk bucks/bulls and does/cows", 9, "species-id"],
  ["bonus-point-chart", "FIGURE", "Bonus Points to Drawing Chances Chart", "Chart of how squared bonus points convert to drawing chances", 45, "drawing-statistics"],
];

const upsertAsset = async (c: PoolClient, cmsDocId: string, kind: string, title: string, alt: string, page: number, seasonYear: number): Promise<string> => {
  const existing = await c.query<{ id: string }>(
    `SELECT asset_id AS id FROM regs.cms_asset WHERE cms_provider='BLOOMREACH' AND cms_doc_id=$1`, [cmsDocId]);
  if (existing.rows[0]) {
    await c.query(
      `UPDATE regs.cms_asset SET asset_kind=$2, title=$3, alt_text=$4, season_year=$5, updated_by='etl' WHERE asset_id=$1`,
      [existing.rows[0].id, kind, title, alt, seasonYear]);
    return existing.rows[0].id;
  }
  const r = await c.query<{ id: string }>(
    `INSERT INTO regs.cms_asset (cms_provider, cms_doc_id, asset_kind, title, alt_text, season_year, updated_by)
     VALUES ('BLOOMREACH',$1,$2,$3,$4,$5,'etl') RETURNING asset_id AS id`,
    [cmsDocId, kind, title, alt, seasonYear]);
  return r.rows[0]!.id;
};

export async function loadPamphletAssets(seasonYear = Number(process.argv[2]) || 2026): Promise<void> {
  let antelopeLinks = 0;
  let figures = 0;
  await withTransaction("etl-pamphlet-assets", async (c) => {
    // ── Antelope per-region district maps (ANTELOPE_HD geography) ──
    for (const region of ANTELOPE_REGIONS) {
      const cmsDocId = `region-${region}-antelope-${seasonYear}-placeholder`;
      const assetId = await upsertAsset(c, cmsDocId, "REGION_MAP",
        `Region ${region} — Antelope District Map`,
        `Map of FWP Region ${region} antelope hunting districts (placeholder pending FWP Bloomreach map)`, 128, seasonYear);
      const link = await c.query(`SELECT 1 FROM regs.region_asset WHERE region_id=$1 AND geography_code='ANTELOPE_HD'`, [region]);
      if (link.rowCount) {
        await c.query(`UPDATE regs.region_asset SET asset_id=$2 WHERE region_id=$1 AND geography_code='ANTELOPE_HD'`, [region, assetId]);
      } else {
        await c.query(`INSERT INTO regs.region_asset (region_id, geography_code, asset_id) VALUES ($1,'ANTELOPE_HD',$2)`, [region, assetId]);
      }
      antelopeLinks++;
    }

    // ── Cover + statewide maps + figures ──
    for (const [suffix, kind, title, alt, page, slug] of FIGURES) {
      const cmsDocId = `${suffix}-${seasonYear}-placeholder`;
      const assetId = await upsertAsset(c, cmsDocId, kind, title, alt, page, seasonYear);
      figures++;
      if (slug) {
        const s = await c.query<{ id: string }>(`SELECT section_id AS id FROM regs.content_section WHERE season_year=$1 AND slug=$2`, [seasonYear, slug]);
        if (s.rows[0]) {
          await c.query(`INSERT INTO regs.content_asset (section_id, asset_id, sort_order) VALUES ($1,$2,0) ON CONFLICT DO NOTHING`, [s.rows[0].id, assetId]);
        }
      }
    }
  });
  const n = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.cms_asset`, []);
  console.log(`Pamphlet assets: ${antelopeLinks} antelope region maps + ${figures} cover/figures (${n.rows[0]!.n} CMS assets total, DRAFT).`);
}

const isMain = process.argv[1]?.endsWith("loadPamphletAssets.ts") || process.argv[1]?.endsWith("loadPamphletAssets.js");
if (isMain) {
  loadPamphletAssets().then(() => closePool()).then(() => process.exit(0)).catch((e) => { console.error(e); void closePool().finally(() => process.exit(1)); });
}
