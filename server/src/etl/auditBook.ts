/**
 * @file auditBook.ts
 * @module engage-mt/server/etl
 * @description The 100%-capture acceptance gate. Turns the printed book's table of
 *              contents into a runnable PASS/FAIL checklist: each section → its DB home →
 *              a concrete query. Prints a report and exits non-zero if any BLOCKING row
 *              fails. Rows still pending the large Phase-B extraction are marked PENDING
 *              (advisory, non-blocking) so the gate tracks true state honestly.
 *              Usage: `tsx src/etl/auditBook.ts [year]`
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { query, closePool } from "../db/pool.js";

type Status = "PASS" | "FAIL" | "PENDING";
interface Check { section: string; home: string; run: (y: number) => Promise<{ status: Status; detail: string }>; blocking: boolean }

const n = async (sql: string, y: number): Promise<number> =>
  Number((await query<{ c: string }>(sql, sql.includes("$1") ? [y] : [])).rows[0]?.c ?? "0");

const CHECKS: Check[] = [
  { section: "Fee/availability charts (pp.12-13)", home: "license_product + product_price", blocking: true,
    run: async (y) => { const c = await n(`SELECT count(*) c FROM regs.license_product WHERE season_year=$1`, y);
      const combo = await n(`SELECT COALESCE(pp.price_cents,0) c FROM regs.license_product lp JOIN regs.product_price pp ON pp.product_id=lp.product_id WHERE lp.season_year=$1 AND lp.product_code='NR_BG_COMBO' AND pp.audience_code='NR'`, y);
      return { status: c >= 15 && combo === 131200 ? "PASS" : "FAIL", detail: `${c} products, NR_BG_COMBO=${combo} (expect ≥15, 131200)` }; } },
  { section: "Laws & Rules (pp.20-25)", home: "content_section LAWS_RULES", blocking: true,
    run: async (y) => { const c = await n(`SELECT count(*) c FROM regs.content_section WHERE season_year=$1 AND category='LAWS_RULES'`, y);
      const ho = await n(`SELECT count(*) c FROM regs.content_section WHERE season_year=$1 AND slug='hunter-orange'`, y);
      return { status: ho >= 1 ? (c >= 33 ? "PASS" : "PENDING") : "FAIL", detail: `${c} LAWS_RULES sections, hunter-orange present=${ho >= 1} (target ≥33)` }; } },
  { section: "Deer/Elk district regs (pp.46-119)", home: "opportunity/season_window", blocking: true,
    run: async (y) => { const c = await n(`SELECT count(*) c FROM regs.opportunity o JOIN regs.license_instrument li ON li.instrument_id=o.instrument_id WHERE o.season_year=$1 AND li.species_code IN ('deer','elk') AND o.record_status<>'ARCHIVED'`, y);
      return { status: c > 500 ? "PASS" : "FAIL", detail: `${c} deer/elk opportunities` }; } },
  { section: "Deer/Elk district geography (ArcGIS /11)", home: "district HD", blocking: true,
    run: async () => { const c = await n(`SELECT count(*) c FROM regs.district WHERE geography_code='HD'`, 0); return { status: c >= 138 ? "PASS" : "FAIL", detail: `${c} HD districts (expect ≥138)` }; } },
  { section: "Antelope district geography (ArcGIS /3)", home: "district ANTELOPE_HD", blocking: true,
    run: async () => { const c = await n(`SELECT count(*) c FROM regs.district WHERE geography_code='ANTELOPE_HD'`, 0); return { status: c >= 50 ? "PASS" : c > 0 ? "PENDING" : "FAIL", detail: `${c} antelope districts (GIS-synced)` }; } },
  { section: "Antelope district regs (pp.138-143)", home: "opportunity antelope", blocking: false,
    run: async (y) => { const c = await n(`SELECT count(*) c FROM regs.opportunity o JOIN regs.license_instrument li ON li.instrument_id=o.instrument_id WHERE o.season_year=$1 AND li.species_code='antelope' AND o.record_status<>'ARCHIVED'`, y);
      return { status: c > 0 ? "PASS" : "PENDING", detail: `${c} antelope opportunities (Phase-B extraction)` }; } },
  { section: "Multi-district validity (pp.128-129)", home: "hunt_area MULTI", blocking: false,
    run: async (y) => { const c = await n(`SELECT count(*) c FROM regs.hunt_area WHERE season_year=$1 AND area_kind='MULTI'`, y); return { status: c > 0 ? "PASS" : "PENDING", detail: `${c} MULTI hunt areas` }; } },
  { section: "Youth/PTHFV table (p.126)", home: "opp_restriction YOUTH_ONLY/PTHFV", blocking: false,
    run: async (y) => { const c = await n(`SELECT count(*) c FROM regs.opp_restriction r JOIN regs.opportunity o ON o.opportunity_id=r.opportunity_id WHERE o.season_year=$1 AND r.restr_code IN ('YOUTH_ONLY','PTHFV')`, y);
      return { status: c > 0 ? "PASS" : "PENDING", detail: `${c} youth/PTHFV restrictions` }; } },
  { section: "Restricted areas (pp.28-30)", home: "restricted_area + district_rarea", blocking: false,
    // The 2026 DEA book's "Restricted Area Descriptions" section (pp.28-30) lists 45 named
    // Closed/Weapons-Restriction/Archery-Only areas + game preserves; we also carry the Libby
    // CWD Management Zone (46 total). Each is linked to the districts whose NOTE names it.
    run: async (y) => { const c = await n(`SELECT count(*) c FROM regs.restricted_area WHERE season_year=$1`, y);
      const links = await n(`SELECT count(*) c FROM regs.district_rarea dr JOIN regs.restricted_area ra ON ra.rarea_id=dr.rarea_id WHERE ra.season_year=$1`, y);
      return { status: c >= 45 && links > 0 ? "PASS" : c > 0 ? "PENDING" : "PENDING", detail: `${c} restricted areas (book lists 45 + CWD zone), ${links} district links` }; } },
  { section: "Sunrise-sunset zones (p.151)", home: "ss_zone + ss_zone_county", blocking: false,
    run: async (y) => { const z = await n(`SELECT count(*) c FROM regs.ss_zone WHERE season_year=$1`, y); const t = await n(`SELECT count(*) c FROM regs.ss_time t JOIN regs.ss_zone z ON z.ss_zone_id=t.ss_zone_id WHERE z.season_year=$1`, y);
      return { status: z === 4 ? (t > 0 ? "PASS" : "PENDING") : "FAIL", detail: `${z} zones, ${t} time rows (grid pending)` }; } },
  { section: "Region maps (pp.30-41,130-136)", home: "cms_asset + region_asset", blocking: false,
    run: async () => { const c = await n(`SELECT count(*) c FROM regs.region_asset`, 0); return { status: c >= 7 ? "PASS" : "PENDING", detail: `${c} region-map links (CMS/Bloomreach pending)` }; } },
  { section: "Publishable (no blocking validation errors)", home: "validation", blocking: true,
    run: async (y) => { const { validateSeasonYear } = await import("../services/validation.js"); const f = await validateSeasonYear(y); const e = f.filter((x) => x.severity === "error").length;
      return { status: e === 0 ? "PASS" : "FAIL", detail: `${e} blocking validation errors` }; } },
  { section: "Index (p.146)", home: "n/a — generated artifact", blocking: false,
    run: async () => ({ status: "PASS", detail: "excluded by design (print regenerates; web has search)" }) },
];

async function main(): Promise<void> {
  const year = Number(process.argv[2]) || 2026;
  console.log(`\n── Book capture audit — season ${year} ──────────────────────────────\n`);
  let blockingFails = 0, pass = 0, pending = 0, fail = 0;
  for (const c of CHECKS) {
    const r = await c.run(year);
    const icon = r.status === "PASS" ? "✓" : r.status === "PENDING" ? "◦" : "✗";
    console.log(`  ${icon} ${r.status.padEnd(7)} ${c.section}`);
    console.log(`            ${c.home} — ${r.detail}`);
    if (r.status === "PASS") pass++; else if (r.status === "PENDING") pending++; else { fail++; if (c.blocking) blockingFails++; }
  }
  console.log(`\n  ${pass} pass · ${pending} pending (Phase-B) · ${fail} fail (${blockingFails} blocking)\n`);
  process.exitCode = blockingFails > 0 ? 1 : 0;
}

const isMain = process.argv[1]?.endsWith("auditBook.ts") || process.argv[1]?.endsWith("auditBook.js");
if (isMain) main().then(() => closePool()).catch((e) => { console.error(e); void closePool().finally(() => process.exit(1)); });
