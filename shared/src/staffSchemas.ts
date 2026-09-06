/**
 * @file staffSchemas.ts
 * @module engage-mt/shared
 * @description Zod request/response schemas for the staff CRUD API. One
 *              source of truth: the server validates bodies against these; the staff SPA
 *              imports the inferred types and reuses the schemas for client-side
 *              pre-validation. Uniform optimistic-lock: mutating a lock-bearing row
 *              carries `expected_updated_at`; child-collection PUTs lock on the parent.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { z } from "zod";
import { DEA_SPECIES, INSTRUMENT_TYPES, SEASON_TYPES, HUNT_AREA_KINDS, RESTRICTED_AREA_TYPES, STAFF_ROLES, AUDITED_TABLES } from "./domain.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const lock = z.object({ expected_updated_at: z.string().min(1) });

// ── Season windows + restrictions (child collections, PUT-replace) ──────────
export const windowInputSchema = z.object({
  season_type_code: z.enum(SEASON_TYPES),
  window_seq: z.number().int().gte(1).default(1),
  starts_on: isoDate,
  ends_on: isoDate,
  raw_range: z.string().max(60).nullable().optional(),
});
export type WindowInput = z.infer<typeof windowInputSchema>;

export const restrictionInputSchema = z.object({
  restr_code: z.string().max(30),
  value_text: z.string().max(200).nullable().optional(),
  raw_text: z.string().max(2000).nullable().optional(),
});
export type RestrictionInput = z.infer<typeof restrictionInputSchema>;

export const putWindowsSchema = lock.extend({ windows: z.array(windowInputSchema).max(24) });
export const putRestrictionsSchema = lock.extend({ restrictions: z.array(restrictionInputSchema).max(16) });

// ── Opportunities ───────────────────────────────────────────────────────────
export const createOpportunitySchema = z.object({
  season_year: z.number().int(),
  instrument_id: z.string().min(1),
  animal_class_id: z.string().min(1),
  hunt_area_id: z.string().min(1),
  home_district_id: z.string().nullable().optional(),
  split_seq: z.number().int().gte(1).default(1),
  validity_note: z.string().max(2000).nullable().optional(),
  windows: z.array(windowInputSchema).max(24).default([]),
  restrictions: z.array(restrictionInputSchema).max(16).default([]),
});
export type CreateOpportunity = z.infer<typeof createOpportunitySchema>;

export const patchOpportunitySchema = lock.extend({
  animal_class_id: z.string().optional(),
  hunt_area_id: z.string().optional(), // = single-opportunity re-point
  split_seq: z.number().int().gte(1).optional(),
  home_district_id: z.string().nullable().optional(),
  validity_note: z.string().max(2000).nullable().optional(),
});

// ── Instruments ─────────────────────────────────────────────────────────────
export const createInstrumentSchema = z.object({
  season_year: z.number().int(),
  instr_type_code: z.enum(INSTRUMENT_TYPES),
  species_code: z.enum(DEA_SPECIES),
  instr_code: z.string().max(12),
  display_name: z.string().max(120),
  is_draw: z.boolean(),
  apply_by: isoDate.nullable().optional(),
  otc_from: isoDate.nullable().optional(),
  quota_current: z.number().int().nullable().optional(),
  quota_unlimited: z.boolean().default(false),
  quota_min: z.number().int().nullable().optional(),
  quota_max: z.number().int().nullable().optional(),
  per_hunter_max: z.number().int().gte(1).nullable().optional(),
});

export const patchInstrumentSchema = lock.extend({
  display_name: z.string().max(120).optional(),
  quota_current: z.number().int().nullable().optional(),
  quota_unlimited: z.boolean().optional(),
  quota_min: z.number().int().nullable().optional(),
  quota_max: z.number().int().nullable().optional(),
  apply_by: isoDate.nullable().optional(),
  otc_from: isoDate.nullable().optional(),
});

// ── Hunt areas ──────────────────────────────────────────────────────────────
export const huntAreaMemberInputSchema = z
  .object({ district_id: z.string().nullable().optional(), portion_id: z.string().nullable().optional() })
  .refine((m) => Boolean(m.district_id) !== Boolean(m.portion_id), "exactly one of district_id / portion_id");
export const createHuntAreaSchema = z.object({
  season_year: z.number().int(),
  area_code: z.string().max(60),
  area_kind: z.enum(HUNT_AREA_KINDS),
  definition_text: z.string().max(2000).nullable().optional(),
  members: z.array(huntAreaMemberInputSchema).max(400).default([]),
});
export const patchHuntAreaSchema = lock.extend({
  area_code: z.string().max(60).optional(),
  definition_text: z.string().max(2000).nullable().optional(),
});
export const putMembersSchema = lock.extend({ members: z.array(huntAreaMemberInputSchema).max(400) });
export const repointSchema = z.object({
  to_hunt_area_id: z.string().min(1),
  opportunity_ids: z.array(z.string()).nullable().optional(),
});

// ── Portions ────────────────────────────────────────────────────────────────
export const createPortionSchema = z.object({
  district_id: z.string().min(1),
  portion_code: z.string().max(40),
  portion_name: z.string().max(200),
  boundary_desc: z.string().nullable().optional(),
});
export const patchPortionSchema = lock.extend({
  portion_name: z.string().max(200).optional(),
  boundary_desc: z.string().nullable().optional(),
});

// ── Restricted areas ────────────────────────────────────────────────────────
export const createRareaSchema = z.object({
  season_year: z.number().int(),
  area_type: z.enum([...RESTRICTED_AREA_TYPES, "MGMT_ZONE"] as [string, ...string[]]),
  area_name: z.string().max(200),
  legal_desc: z.string().nullable().optional(),
});
export const patchRareaSchema = lock.extend({
  area_type: z.enum([...RESTRICTED_AREA_TYPES, "MGMT_ZONE"] as [string, ...string[]]).optional(),
  area_name: z.string().max(200).optional(),
  legal_desc: z.string().nullable().optional(),
});
export const putRareaDistrictsSchema = lock.extend({
  links: z.array(z.object({ district_id: z.string(), note: z.string().max(1000).nullable().optional() })).max(200),
});

// ── Notes ───────────────────────────────────────────────────────────────────
export const createNoteSchema = z.object({
  season_year: z.number().int(),
  district_code: z.string(),
  geography_code: z.enum(["HD", "ANTELOPE_HD"]).default("HD"),
  species_code: z.enum(DEA_SPECIES).nullable().optional(),
  note_text: z.string().min(1).max(2000),
});
export const patchNoteSchema = lock.extend({
  note_text: z.string().min(1).max(2000).optional(),
  species_code: z.enum(DEA_SPECIES).nullable().optional(),
});

// ── Users (admin) ───────────────────────────────────────────────────────────
export const createUserSchema = z.object({
  email: z.string().email(),
  display_name: z.string().max(120),
  role: z.enum(STAFF_ROLES),
});
export const patchUserSchema = z.object({
  role: z.enum(STAFF_ROLES).optional(),
  display_name: z.string().max(120).optional(),
  is_active: z.boolean().optional(),
});
export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  // CIS L1 password length (NIST 800-63B favors length over composition). The
  // .max bounds argon2 hashing cost against a huge-input DoS.
  new_password: z.string().min(14, "at least 14 characters").max(200),
});

// ── Season years ────────────────────────────────────────────────────────────
export const createSeasonYearSchema = z.object({
  season_year: z.number().int().gte(2020).lte(2100),
  starts_on: isoDate,
  ends_on: isoDate,
  notes: z.string().max(2000).nullable().optional(),
});

// ── Publish ─────────────────────────────────────────────────────────────────
export const publishSchema = z.object({ note: z.string().min(1).max(1000) });

// ── Audit log ───────────────────────────────────────────────────────────────
const isoDateTime = z.string().datetime({ offset: true });
/** `GET /staff/audit-log` filters + keyset cursor (`before` = last audit_id seen). */
export const auditLogQuerySchema = z
  .object({
    table: z.enum(AUDITED_TABLES).optional(),
    user: z.string().trim().min(1).max(120).optional(),
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
    before: z.string().regex(/^\d+$/, "before must be an audit id").optional(),
    limit: z.coerce.number().int().gte(1).lte(500).default(100),
  })
  .refine((q) => !(q.from && q.to) || q.from < q.to, { message: "from must be before to" });
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
/** `GET /staff/audit-log.csv` takes the same filters, no cursor or limit. */
export const auditLogExportSchema = auditLogQuerySchema.innerType().omit({ before: true, limit: true });
