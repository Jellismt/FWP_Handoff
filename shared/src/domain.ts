/**
 * @file domain.ts
 * @module engage-mt/shared
 * @description Rich domain vocabularies + zod schemas for the normalized regs model
 *              (§5 of the plan). These are the request/response shapes the staff CRUD
 *              API validates against and the v2 read API emits. Enum-like values are
 *              const tuples (mirror the DB CHECK-constraint lookup tables) so server,
 *              staff SPA, and tests share one source of truth.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { z } from "zod";

/** Record lifecycle — mirrors the `record_status` / `status_code` CHECK constraints. */
export const RECORD_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

/** DEA species handled by this database (v1). Antelope has its own geography. */
export const DEA_SPECIES = ["deer", "elk", "antelope"] as const;
export type DeaSpecies = (typeof DEA_SPECIES)[number];

/** District geography codes — deer/elk share HD; antelope is separate. */
export const GEOGRAPHY_CODES = ["HD", "ANTELOPE_HD"] as const;
export type GeographyCode = (typeof GEOGRAPHY_CODES)[number];

/** License/permit instrument taxonomy. */
export const INSTRUMENT_TYPES = [
  "GENERAL",
  "PERMIT",
  "B_LICENSE",
  "SPECIES_LICENSE",
  "B_SPECIES_LICENSE",
] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

/** Season date-window column names (deer/elk 5-col + antelope). */
export const SEASON_TYPES = [
  "EARLY",
  "ARCHERY",
  "GENERAL",
  "HERITAGE_ML",
  "LATE",
  "SEASON",
] as const;
export type SeasonType = (typeof SEASON_TYPES)[number];

/** Hunt-area shape. */
export const HUNT_AREA_KINDS = ["DISTRICT", "PORTION", "MULTI"] as const;
export type HuntAreaKind = (typeof HUNT_AREA_KINDS)[number];

/** Restriction category — coarse bucket for the structured restriction vocabulary. */
export const RESTRICTION_CATEGORIES = [
  "LAND_CLASS",
  "EQUIPMENT",
  "ELIGIBILITY",
  "PURCHASE",
  "GEO_LIMIT",
  "BAG",
  "OTHER",
] as const;
export type RestrictionCategory = (typeof RESTRICTION_CATEGORIES)[number];

/** Restricted-area type. */
export const RESTRICTED_AREA_TYPES = [
  "RESTRICTED",
  "WEAPONS_RESTR",
  "CLOSURE",
  "ARCHERY_ONLY",
] as const;
export type RestrictedAreaType = (typeof RESTRICTED_AREA_TYPES)[number];

/** Staff RBAC roles, strictly ordered viewer < editor < approver < admin. */
export const STAFF_ROLES = ["viewer", "editor", "approver", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Tables the audit-log triggers write for; also the staff filter options. */
export const AUDITED_TABLES = [
  "license_instrument",
  "opportunity",
  "season_window",
  "opp_restriction",
  "hunt_area",
  "district_note",
  "restricted_area",
  "district_portion",
  "content_section",
  "license_product",
  "season_year",
] as const;
export type AuditedTable = (typeof AUDITED_TABLES)[number];

/** Numeric rank so `requireRole` can compare (viewer=0 … admin=3). */
export const ROLE_RANK: Readonly<Record<StaffRole, number>> = {
  viewer: 0,
  editor: 1,
  approver: 2,
  admin: 3,
};

// ── ISO date helpers ────────────────────────────────────────────────────────
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected ISO date YYYY-MM-DD");

// ── Season year ─────────────────────────────────────────────────────────────
export const seasonYearSchema = z.object({
  season_year: z.number().int().gte(2000).lte(2100),
  starts_on: isoDate,
  ends_on: isoDate,
  adopted_on: isoDate.nullable(),
  status_code: z.enum(RECORD_STATUSES),
  notes: z.string().max(2000).nullable(),
});
export type SeasonYear = z.infer<typeof seasonYearSchema>;

// ── Hunt-area member + hunt-area ────────────────────────────────────────────
export const huntAreaMemberSchema = z.object({
  member_seq: z.number().int().gte(1),
  district_code: z.string().nullable(),
  portion_code: z.string().nullable(),
});
export type HuntAreaMember = z.infer<typeof huntAreaMemberSchema>;

export const huntAreaSchema = z.object({
  season_year: z.number().int(),
  area_code: z.string().max(60),
  area_kind: z.enum(HUNT_AREA_KINDS),
  definition_text: z.string().max(2000).nullable(),
  members: z.array(huntAreaMemberSchema),
});
export type HuntArea = z.infer<typeof huntAreaSchema>;

// ── License instrument ──────────────────────────────────────────────────────
export const licenseInstrumentSchema = z.object({
  season_year: z.number().int(),
  instr_type_code: z.enum(INSTRUMENT_TYPES),
  species_code: z.enum(DEA_SPECIES),
  /** NNN-NN, or synthetic 'GEN-<species>'. */
  instr_code: z.string().max(12),
  display_name: z.string().max(120),
  is_draw: z.boolean(),
  apply_by: isoDate.nullable(),
  otc_from: isoDate.nullable(),
  quota_current: z.number().int().nullable(),
  quota_unlimited: z.boolean(),
  quota_min: z.number().int().nullable(),
  quota_max: z.number().int().nullable(),
  per_hunter_max: z.number().int().gte(1).nullable(),
});
export type LicenseInstrument = z.infer<typeof licenseInstrumentSchema>;

// ── Season window ───────────────────────────────────────────────────────────
export const seasonWindowSchema = z.object({
  season_type_code: z.enum(SEASON_TYPES),
  window_seq: z.number().int().gte(1),
  starts_on: isoDate,
  ends_on: isoDate,
  raw_range: z.string().max(60).nullable(),
});
export type SeasonWindow = z.infer<typeof seasonWindowSchema>;

// ── Opportunity restriction ─────────────────────────────────────────────────
export const oppRestrictionSchema = z.object({
  restr_seq: z.number().int().gte(1),
  restr_code: z.string().max(30),
  value_text: z.string().max(200).nullable(),
  raw_text: z.string().max(2000),
});
export type OppRestriction = z.infer<typeof oppRestrictionSchema>;

// ── Opportunity (the printed row/sub-row) ───────────────────────────────────
export const opportunitySchema = z.object({
  season_year: z.number().int(),
  instr_code: z.string().max(12),
  animal_class_code: z.string().max(60),
  hunt_area_code: z.string().max(60),
  split_seq: z.number().int().gte(1),
  home_district_code: z.string().nullable(),
  print_order: z.number().int().nullable(),
  validity_note: z.string().max(2000).nullable(),
  windows: z.array(seasonWindowSchema),
  restrictions: z.array(oppRestrictionSchema),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

/**
 * Optimistic-lock envelope: every editable GET returns `updated_at`, every PATCH
 * echoes it as `expected_updated_at`. Mismatch → 409.
 */
export const optimisticLockSchema = z.object({
  expected_updated_at: z.string(),
});
