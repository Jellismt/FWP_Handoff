/**
 * @file seed.ts
 * @module engage-mt/server/db
 * @description Idempotent seed of the stable reference vocabularies (regions,
 *              geography, species, instrument/season/restriction types, the ~30 DEA
 *              legal-animal classes), the 2026 season year + source doc, and
 *              the first admin (env-driven, behind an is-empty guard). Uses portable
 *              INSERT … WHERE NOT EXISTS (no ON CONFLICT) so it re-runs safely and the
 *              SQL ports to Oracle. Run after `migrate up`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-05
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ARCGIS_HUNTING_DISTRICTS_SERVICE, arcgisLayerByKey } from "@engage-mt/regs-shared";
import { getPool, closePool, query } from "./pool.js";
import { loadConfig } from "../config.js";

/** Insert a row only if a matching key is absent (portable idempotency). */
async function insertIfAbsent(
  table: string,
  keyCols: string[],
  keyVals: unknown[],
  allCols: string[],
  allVals: unknown[],
): Promise<void> {
  const placeholders = allVals.map((_, i) => `$${i + 1}`).join(", ");
  // Key placeholders come AFTER the value placeholders (params = [...allVals, ...keyVals]).
  const wherePairs = keyCols.map((c, i) => `${c} = $${allVals.length + i + 1}`).join(" AND ");
  await query(
    `INSERT INTO ${table} (${allCols.join(", ")})
     SELECT ${placeholders}
     WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE ${wherePairs})`,
    [...allVals, ...keyVals],
  );
}

const REGIONS: [number, string][] = [
  [1, "Region 1 — Kalispell"],
  [2, "Region 2 — Missoula"],
  [3, "Region 3 — Bozeman"],
  [4, "Region 4 — Great Falls"],
  [5, "Region 5 — Billings"],
  [6, "Region 6 — Glasgow"],
  [7, "Region 7 — Miles City"],
];

const GEOGRAPHY: [string, string, number, string][] = [
  ["HD", "Deer / Elk Hunting District", 11, "hd"],
  ["ANTELOPE_HD", "Antelope Hunting District", 3, "antelope-hd"],
];

const SPECIES: [string, string, string][] = [
  ["deer", "Deer", "HD"],
  ["elk", "Elk", "HD"],
  ["antelope", "Antelope", "ANTELOPE_HD"],
];

const INSTRUMENT_TYPES: [string, string, number][] = [
  ["GENERAL", "General License", 0],
  ["PERMIT", "Permit (drawing)", 1],
  ["B_LICENSE", "B License", 0],
  ["SPECIES_LICENSE", "Species License", 1],
  ["B_SPECIES_LICENSE", "B Species License", 1],
];

// Fee-chart pricing tiers (0013). Discounted variants (NR-native, youth-sponsored,
// college) are audience rows on the same product — mirrors the printed chart.
const AUDIENCES: [string, string, string, number][] = [
  ["RES", "Resident 18-61", "RES", 1],
  ["RES_YOUTH", "Resident Youth 12-17", "RES", 2],
  ["RES_SENIOR", "Resident Senior 62+", "RES", 3],
  ["RES_DISABLED", "Resident Disabled", "RES", 4],
  ["NR", "Nonresident", "NR", 5],
  ["NR_NATIVE", "Nonresident Native", "NR", 6],
  ["NR_YOUTH_SPONSORED", "Nonresident Youth (sponsored)", "NR", 7],
  ["NR_COLLEGE", "Nonresident College Student", "NR", 8],
];

const SEASON_TYPES: [string, string, string, number][] = [
  ["EARLY", "Early Season", "Early", 1],
  ["ARCHERY", "Archery Only", "Archery", 2],
  ["GENERAL", "General Season", "General", 3],
  ["HERITAGE_ML", "Heritage Muzzleloader", "Muzzleloader", 4],
  ["LATE", "Late Season", "Late", 5],
  ["SEASON", "Season (antelope general)", "General", 3],
];

const RESTRICTION_TYPES: [string, string, string, number][] = [
  ["PRIVATE_LAND_ONLY", "LAND_CLASS", "Private land only", 0],
  ["OUTSIDE_NF_ONLY", "LAND_CLASS", "Outside National Forest boundary", 0],
  ["NOT_WMA", "LAND_CLASS", "Not valid on FWP WMAs", 0],
  ["NOT_BLM", "LAND_CLASS", "Not valid on BLM lands", 0],
  ["DNRC_VALID", "LAND_CLASS", "Valid on DNRC lands", 0],
  ["ARCHERY_EQUIP_ONLY", "EQUIPMENT", "Archery equipment only", 0],
  ["SHOTGUN_TRAD_ONLY", "EQUIPMENT", "Shotgun / traditional handgun / muzzleloader / crossbow only", 0],
  ["YOUTH_ONLY", "ELIGIBILITY", "Youth only", 1],
  ["PTHFV", "ELIGIBILITY", "Permit to Hunt From a Vehicle holders", 0],
  ["PER_HUNTER_LIMIT", "BAG", "Per-hunter limit", 1],
  ["PURCHASE_BEFORE", "PURCHASE", "Must purchase before a date", 1],
  ["FIRST_CHOICE_ONLY", "PURCHASE", "First and only choice", 0],
  ["MANDATORY_CHECK", "OTHER", "Mandatory check required", 0],
  ["FIRST_COME_OTC", "PURCHASE", "Over-the-counter, first come", 0],
  ["OTHER", "OTHER", "Other restriction (see raw text)", 0],
];

// ~30 recurring DEA legal-animal class labels. class_code is a stable slug.
const ANIMAL_CLASSES: [string, string, string][] = [
  // deer
  ["deer", "ANTLERED_BUCK_MD", "Antlered Buck Mule Deer"],
  ["deer", "ANTLERLESS_MD", "Antlerless Mule Deer"],
  ["deer", "ANTLERED_BUCK_WTD", "Antlered Buck White-tailed Deer"],
  ["deer", "ANTLERLESS_WTD", "Antlerless White-tailed Deer"],
  ["deer", "ES_WTD", "Either-sex White-tailed Deer"],
  ["deer", "ES_MD", "Either-sex Mule Deer"],
  ["deer", "ES_DEER", "Either-sex Deer"],
  // elk
  ["elk", "BTB_ELK", "Brow-tined Bull Elk"],
  ["elk", "ANTLERLESS_ELK", "Antlerless Elk"],
  ["elk", "BTB_OR_ANTLERLESS_ELK", "Brow-tined Bull or Antlerless Elk"],
  ["elk", "SPIKE_OR_ANTLERLESS_ELK", "Spike Bull or Antlerless Elk"],
  ["elk", "ES_ELK", "Either-sex Elk"],
  ["elk", "BROW_TINED_BULL", "Brow-tined Bull"],
  // antelope
  ["antelope", "ES_ANTELOPE", "Either-sex"],
  ["antelope", "DOE_FAWN", "Doe/Fawn"],
];

const SEASON_YEARS: [number, string, string, string][] = [
  // season_year, starts_on, ends_on, adopted_on
  // The app carries the current book forward only (2026+).
  [2026, "2026-03-01", "2027-02-28", "2025-12-04"],
];

const SOURCE_DOCS: [number, string, string, string, string, string][] = [
  // season_year, doc_code, title, file_name, valid_from, valid_to
  [2026, "dea-2026", "2026 Montana Deer, Elk & Antelope Hunting Regulations", "dea-2026.pdf", "2026-03-01", "2027-02-28"],
];

async function seedLookups(): Promise<void> {
  for (const [id, name] of REGIONS) {
    await insertIfAbsent("regs.region", ["region_id"], [id], ["region_id", "region_name"], [id, name]);
  }
  for (const [code, name, layer, appType] of GEOGRAPHY) {
    await insertIfAbsent(
      "regs.geography", ["geography_code"], [code],
      ["geography_code", "display_name", "arcgis_layer_id", "app_geo_type"], [code, name, layer, appType],
    );
  }
  // Backfill the self-describing service URL (0019). insertIfAbsent skips rows that
  // already exist, so set it explicitly; idempotent (only touches NULLs).
  await query(
    `UPDATE regs.geography SET arcgis_service_url = $1 WHERE arcgis_service_url IS NULL`,
    [ARCGIS_HUNTING_DISTRICTS_SERVICE],
  );
  for (const [code, name, geo] of SPECIES) {
    await insertIfAbsent("regs.species", ["species_code"], [code], ["species_code", "display_name", "geography_code"], [code, name, geo]);
  }
  for (const [code, name, draw] of INSTRUMENT_TYPES) {
    await insertIfAbsent("regs.instrument_type", ["instr_type_code"], [code], ["instr_type_code", "display_name", "is_draw_default"], [code, name, draw]);
  }
  for (const [code, name, label, sort] of SEASON_TYPES) {
    await insertIfAbsent("regs.season_type", ["season_type_code"], [code], ["season_type_code", "display_name", "weapon_label", "sort_order"], [code, name, label, sort]);
  }
  for (const [code, cat, name, needsVal] of RESTRICTION_TYPES) {
    await insertIfAbsent("regs.restriction_type", ["restr_code"], [code], ["restr_code", "category", "display_name", "needs_value"], [code, cat, name, needsVal]);
  }
  for (const [code, name, residency, sort] of AUDIENCES) {
    await insertIfAbsent("regs.audience", ["audience_code"], [code], ["audience_code", "display_name", "residency", "sort_order"], [code, name, residency, sort]);
  }
  for (const [species, code, label] of ANIMAL_CLASSES) {
    await insertIfAbsent("regs.legal_animal_class", ["species_code", "class_code"], [species, code], ["species_code", "class_code", "display_label"], [species, code, label]);
  }
  for (const [yr, starts, ends, adopted] of SEASON_YEARS) {
    await insertIfAbsent("regs.season_year", ["season_year"], [yr], ["season_year", "starts_on", "ends_on", "adopted_on", "status_code"], [yr, starts, ends, adopted, "DRAFT"]);
  }
  for (const [yr, code, title, file, from, to] of SOURCE_DOCS) {
    await insertIfAbsent(
      "regs.source_document", ["season_year", "doc_code"], [yr, code],
      ["season_year", "doc_code", "title", "file_name", "adopted_on", "valid_from", "valid_to"],
      [yr, code, title, file, SEASON_YEARS.find((s) => s[0] === yr)?.[3] ?? null, from, to],
    );
  }
}

// The GIS layers the v1 regs DB (deer/elk/antelope) actually links to. The FULL
// multi-species map lives in @engage-mt/regs-shared (ARCGIS_HD_LAYERS) and backs
// the web layer registry; the DB seeds only what it models today. When sheep/moose/
// etc. regs are added, add their geography row + extend this list.
const GIS_LAYER_SEED_KEYS = [
  "hd-district", "antelope-district",
  "antelope-portion", "mule-deer-portion", "wtd-portion", "elk-portion",
  "biggame-restricted", "elk-restricted",
];

const ENTITY_KIND_DB: Record<string, string> = {
  district: "DISTRICT",
  portion: "PORTION",
  restricted_area: "RESTRICTED_AREA",
};

/** Seed regs.gis_layer from the shared registry — the DB's self-describing ESRI link. */
async function seedGisLayers(): Promise<void> {
  for (const key of GIS_LAYER_SEED_KEYS) {
    const def = arcgisLayerByKey(key);
    if (!def) {
      console.warn(`• gis_layer: unknown registry key "${key}" — skipped`);
      continue;
    }
    await insertIfAbsent(
      "regs.gis_layer", ["gis_layer_key"], [def.key],
      ["gis_layer_key", "entity_kind", "service_url", "layer_id", "key_field",
        "sub_key_field", "display_name", "species_scope", "geography_code", "schema_probed"],
      [def.key, ENTITY_KIND_DB[def.entityKind], ARCGIS_HUNTING_DISTRICTS_SERVICE, def.layerId,
        def.keyField, def.subKeyField ?? null, def.displayName, def.speciesScope,
        def.geographyCode, def.schemaProbed ? 1 : 0],
    );
  }
}

async function seedFirstAdmin(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.SEED_ADMIN_EMAIL || !cfg.SEED_ADMIN_PASSWORD) {
    console.log("• No SEED_ADMIN_* set — skipping admin seed.");
    return;
  }
  const existing = await query<{ n: string }>("SELECT count(*) AS n FROM regs.staff_user");
  if (Number(existing.rows[0]?.n ?? "0") > 0) {
    console.log("• staff_user not empty — skipping admin seed.");
    return;
  }
  const { hash } = await import("@node-rs/argon2");
  const pwHash = await hash(cfg.SEED_ADMIN_PASSWORD);
  await query(
    `INSERT INTO regs.staff_user (email, password_hash, display_name, role, must_reset)
     VALUES ($1, $2, $3, 'admin', 1)`,
    [cfg.SEED_ADMIN_EMAIL, pwHash, "FWP Admin"],
  );
  console.log(`• Seeded first admin: ${cfg.SEED_ADMIN_EMAIL} (must reset on first login).`);
}

export async function seed(): Promise<void> {
  await seedLookups();
  await seedGisLayers();
  await seedFirstAdmin();
  console.log("Seed complete.");
}

const isMain = process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js");
if (isMain) {
  seed()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      void closePool().finally(() => process.exit(1));
    });
}

void getPool; // referenced for pool lifecycle symmetry
