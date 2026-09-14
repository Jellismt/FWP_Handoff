/**
 * @file globalSetup.ts
 * @module engage-mt/server/test
 * @description Vitest global setup: (re)creates the test database, runs all migrations
 *              + the seed, then loads a small fixture set (districts, instruments,
 *              opportunities incl. a YOUTH_ONLY one, hunt areas, one user per role + a
 *              must-reset user). TEST_DATABASE_URL points at the throwaway Postgres
 *              (docker-compose.test.yml in CI, or a local cluster's DB).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import pg from "pg";

const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:55432/regs_test";
const MAINT_URL = process.env.TEST_MAINT_URL ?? deriveMaint(TEST_URL);

function deriveMaint(url: string): string {
  // Same server, `postgres` maintenance DB — used to (re)create the test DB.
  return url.replace(/\/[^/]+$/, "/postgres");
}
function dbName(url: string): string {
  return url.slice(url.lastIndexOf("/") + 1).replace(/\?.*$/, "");
}

export default async function setup(): Promise<void> {
  process.env.DATABASE_URL = TEST_URL;
  process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-secret-abcdefghijklmnop";
  process.env.SKIP_POSTGIS = "1";
  process.env.NODE_ENV = "test";

  const name = dbName(TEST_URL);
  const maint = new pg.Client({ connectionString: MAINT_URL });
  await maint.connect();
  await maint.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await maint.query(`CREATE DATABASE ${name}`);
  await maint.end();

  // Migrate + seed against the fresh DB (dynamic import so DATABASE_URL is set first).
  const { migrateUp } = await import("../src/db/migrate.js");
  await migrateUp();
  const { seed } = await import("../src/db/seed.js");
  process.env.SEED_ADMIN_EMAIL = "admin@fwp.mt.gov";
  process.env.SEED_ADMIN_PASSWORD = "admin-password-123456";
  await seed();

  await loadFixtures();
  const { closePool } = await import("../src/db/pool.js");
  await closePool();
}

async function loadFixtures(): Promise<void> {
  const { query, withTransaction } = await import("../src/db/pool.js");
  const { hash } = await import("@node-rs/argon2");

  // Users: one per role (password "test-password-123456") + a must-reset user.
  const pw = await hash("test-password-123456");
  for (const [email, role, mustReset] of [
    ["viewer@fwp.mt.gov", "viewer", 0],
    ["editor@fwp.mt.gov", "editor", 0],
    ["approver@fwp.mt.gov", "approver", 0],
    ["mustreset@fwp.mt.gov", "editor", 1],
  ] as const) {
    await query(
      `INSERT INTO regs.staff_user (email, password_hash, display_name, role, must_reset) VALUES ($1,$2,$3,$4,$5)`,
      [email, pw, email, role, mustReset],
    );
  }
  // Clear the seeded admin's must_reset so tests can use it directly.
  await query(`UPDATE regs.staff_user SET must_reset = 0 WHERE email = 'admin@fwp.mt.gov'`);

  // Minimal regulation fixtures under season 2026.
  await withTransaction("fixtures", async (c) => {
    const dRes = await c.query<{ id: string }>(
      `INSERT INTO regs.district (geography_code, district_code, region_id, district_name, first_season)
       VALUES ('HD','900',1,'Test District',2026) RETURNING district_id AS id`,
    );
    const districtId = dRes.rows[0]!.id;
    const haRes = await c.query<{ id: string }>(
      `INSERT INTO regs.hunt_area (season_year, area_code, area_kind, definition_text)
       VALUES (2026,'HD-900','DISTRICT','Test') RETURNING hunt_area_id AS id`,
    );
    const haId = haRes.rows[0]!.id;
    await c.query(`INSERT INTO regs.hunt_area_member (hunt_area_id, member_seq, district_id) VALUES ($1,1,$2)`, [haId, districtId]);

    const liRes = await c.query<{ id: string }>(
      `INSERT INTO regs.license_instrument (season_year, instr_type_code, species_code, instr_code, display_name, is_draw, quota_current, quota_min, quota_max)
       VALUES (2026,'B_LICENSE','deer','900-00','Deer B License: 900-00',1,50,5,100) RETURNING instrument_id AS id`,
    );
    const genRes = await c.query<{ id: string }>(
      `INSERT INTO regs.license_instrument (season_year, instr_type_code, species_code, instr_code, display_name, is_draw)
       VALUES (2026,'GENERAL','deer','GEN-DEER','General Deer License',0) RETURNING instrument_id AS id`,
    );
    const classRes = await c.query<{ id: string }>(
      `SELECT animal_class_id AS id FROM regs.legal_animal_class WHERE species_code='deer' AND class_code='ANTLERLESS_WTD' LIMIT 1`,
    );
    const classId = classRes.rows[0]!.id;

    // A general-license opportunity (so validation is clean) + a B-license one with a YOUTH_ONLY restriction.
    const o1 = await c.query<{ id: string }>(
      `INSERT INTO regs.opportunity (season_year, instrument_id, animal_class_id, hunt_area_id, home_district_id)
       VALUES (2026,$1,$2,$3,$4) RETURNING opportunity_id AS id`, [genRes.rows[0]!.id, classId, haId, districtId]);
    await c.query(`INSERT INTO regs.season_window (opportunity_id, season_type_code, window_seq, starts_on, ends_on, raw_range)
                   VALUES ($1,'GENERAL',1,'2026-10-24','2026-11-29','Oct 24-Nov 29')`, [o1.rows[0]!.id]);

    const o2 = await c.query<{ id: string }>(
      `INSERT INTO regs.opportunity (season_year, instrument_id, animal_class_id, hunt_area_id, home_district_id)
       VALUES (2026,$1,$2,$3,$4) RETURNING opportunity_id AS id`, [liRes.rows[0]!.id, classId, haId, districtId]);
    await c.query(`INSERT INTO regs.opp_restriction (opportunity_id, restr_seq, restr_code, value_text, raw_text)
                   VALUES ($1,1,'YOUTH_ONLY','10-15','Only youth ages 10-15.')`, [o2.rows[0]!.id]);
  });
}
