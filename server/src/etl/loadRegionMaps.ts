/**
 * @file loadRegionMaps.ts
 * @module engage-mt/server/etl
 * @description Seeds the per-region deer/elk district-map plate inventory (book
 *              pp.30-41) as CMS assets + region_asset links. Until FWP wires the real
 *              Bloomreach maps (STUB-035), these are PLACEHOLDER assets: the CmsProvider
 *              stub renders a deterministic placeholder SVG per cms_doc_id, so the
 *              region-map surface is populated and swappable one env-flip later. One
 *              REGION_MAP asset + region_asset link per FWP region 1-7 for the HD
 *              (deer/elk) geography. Idempotent per cms_doc_id. Loads DRAFT.
 *              Usage: `tsx src/etl/loadRegionMaps.ts [year]` (default 2026).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { withTransaction, closePool, query } from "../db/pool.js";

const REGIONS = [1, 2, 3, 4, 5, 6, 7] as const;
const GEOGRAPHY = "HD"; // deer/elk district geography

export async function loadRegionMaps(seasonYear = Number(process.argv[2]) || 2026): Promise<void> {
  await withTransaction("etl-region-maps", async (c) => {
    for (const region of REGIONS) {
      const cmsDocId = `region-${region}-deer-elk-${seasonYear}-placeholder`;
      const title = `Region ${region} — Deer & Elk District Map`;
      const altText = `Map of FWP Region ${region} deer and elk hunting districts (placeholder pending FWP Bloomreach map)`;

      // Upsert the CMS asset (unique on cms_provider + cms_doc_id).
      const existing = await c.query<{ id: string }>(
        `SELECT asset_id AS id FROM regs.cms_asset WHERE cms_provider='BLOOMREACH' AND cms_doc_id=$1`, [cmsDocId]);
      let assetId = existing.rows[0]?.id;
      if (assetId) {
        await c.query(
          `UPDATE regs.cms_asset SET asset_kind='REGION_MAP', title=$2, alt_text=$3, season_year=$4, updated_by='etl' WHERE asset_id=$1`,
          [assetId, title, altText, seasonYear]);
      } else {
        const r = await c.query<{ id: string }>(
          `INSERT INTO regs.cms_asset (cms_provider, cms_doc_id, asset_kind, title, alt_text, season_year, updated_by)
           VALUES ('BLOOMREACH',$1,'REGION_MAP',$2,$3,$4,'etl') RETURNING asset_id AS id`,
          [cmsDocId, title, altText, seasonYear]);
        assetId = r.rows[0]!.id;
      }

      // Link region × geography → asset (PK = region_id, geography_code).
      const link = await c.query(
        `SELECT 1 FROM regs.region_asset WHERE region_id=$1 AND geography_code=$2`, [region, GEOGRAPHY]);
      if (link.rowCount) {
        await c.query(`UPDATE regs.region_asset SET asset_id=$3 WHERE region_id=$1 AND geography_code=$2`,
          [region, GEOGRAPHY, assetId]);
      } else {
        await c.query(`INSERT INTO regs.region_asset (region_id, geography_code, asset_id) VALUES ($1,$2,$3)`,
          [region, GEOGRAPHY, assetId]);
      }
    }
  });
  const n = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.region_asset`, []);
  console.log(`Region maps: ${n.rows[0]!.n} region_asset links (placeholder CMS assets, DRAFT).`);
}

const isMain = process.argv[1]?.endsWith("loadRegionMaps.ts") || process.argv[1]?.endsWith("loadRegionMaps.js");
if (isMain) {
  loadRegionMaps().then(() => closePool()).then(() => process.exit(0)).catch((e) => { console.error(e); void closePool().finally(() => process.exit(1)); });
}
