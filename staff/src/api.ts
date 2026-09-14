/**
 * @file api.ts
 * @module engage-mt/staff
 * @description Typed fetch client for the Regs Manager API. Same-origin (cookies flow
 *              automatically); unwraps the standard envelope and surfaces errors.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-14
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { Envelope, NormalizedRegulation, StaffRole } from "@engage-mt/regs-shared";

const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function requestEnvelope<T>(path: string, init?: RequestInit): Promise<Envelope<T>> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "same-origin",
  });
  if (res.status === 304) return { data: [], meta: null };
  const body = (await res.json()) as Envelope<T>;
  if (!res.ok || (body.errors && body.errors.length > 0)) {
    const err = body.errors?.[0];
    throw new ApiError(res.status, err?.code ?? "INTERNAL", err?.message ?? res.statusText);
  }
  return body;
}

async function request<T>(path: string, init?: RequestInit): Promise<T[]> {
  return (await requestEnvelope<T>(path, init)).data ?? [];
}

/** Filters for the audit log; `before` is the keyset cursor from the previous page. */
export interface AuditLogQueryInput {
  table?: string;
  user?: string;
  from?: string;
  to?: string;
  before?: string;
  limit?: number;
}

const auditLogSearch = (opts: AuditLogQueryInput): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export interface StaffMe {
  email: string;
  displayName: string;
  role: StaffRole;
  mustReset: boolean;
}

export interface SeasonYearRow {
  season_year: number;
  status_code: string;
  starts_on: string;
  ends_on: string;
  adopted_on: string | null;
  version: number | null;
  instrument_count: string;
}

export interface DistrictRow {
  district_id: string | null;
  district_code: string;
  geography_code: string;
  region_id: number;
  district_name: string | null;
  instrument_count: string;
}

export interface ValidationFinding {
  severity: "error" | "warning";
  code: string;
  message: string;
  anchor: string | null;
}

export interface OpportunityRow {
  opportunity_id: string;
  split_seq: number;
  instrument_id: string;
  instr_code: string;
  instrument_name: string;
  instr_type_code: string;
  species_code: string;
  is_draw: number;
  quota_current: number | null;
  quota_min: number | null;
  quota_max: number | null;
  quota_unlimited: number;
  apply_by: string | null;
  otc_from: string | null;
  animal_class_id: string;
  hunt_area_id: string;
  legal_animal: string;
  area_code: string;
  validity_note: string | null;
  record_status: string;
  updated_at?: string;
  /** Lock token for the opportunity's shared instrument (own timestamp). */
  instrument_updated_at?: string;
  windows: { season_type: string; raw_range: string | null; starts_on: string; ends_on: string }[];
  restrictions: { restr_code: string; value_text: string | null; raw_text: string }[];
}

export interface DistrictNoteRow {
  note_id: string;
  species_code: string | null;
  note_text: string;
  record_status: string;
  updated_at?: string;
}

export interface DistrictDetail {
  district_code: string;
  district_id: string | null;
  opportunities: OpportunityRow[];
  notes: DistrictNoteRow[];
}

export interface AnimalClassRow { animal_class_id: string; species_code: string; class_code: string; display_label: string; }
export interface RestrictionTypeRow { restr_code: string; category: string; display_name: string; needs_value: number; }
export interface PortionRow { portion_id: string; district_id: string; portion_code: string; portion_name: string; boundary_desc: string | null; }
export interface RegionRow { region_id: number; region_name: string; }
export interface InstrumentRow {
  instrument_id: string; instr_code: string; display_name: string; instr_type_code: string; species_code: string;
  is_draw: number; quota_current: number | null; quota_min: number | null; quota_max: number | null; quota_unlimited: number;
  updated_at: string; opportunity_count: string;
}
export interface AssetRow {
  asset_id: string; cms_provider: string; cms_doc_id: string; asset_kind: string;
  title: string; caption: string | null; alt_text: string | null; season_year: number | null; cached_url: string | null;
}

export const api = {
  login: (email: string, password: string) =>
    request<StaffMe>("/staff/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request("/staff/auth/logout", { method: "POST" }),
  me: () => request<StaffMe>("/staff/auth/me"),
  seasonYears: () => request<SeasonYearRow>("/staff/season-years"),
  validation: (year: number) => request<ValidationFinding>(`/staff/season-years/${year}/validation`),
  publish: (year: number, note: string, correction?: { correction_summary?: string; affected_species?: string; affected_districts?: string }) =>
    request(`/staff/season-years/${year}/publish`, { method: "POST", body: JSON.stringify({ note, ...correction }) }),
  cloneForward: (toYear: number, fromYear: number) =>
    request<Record<string, number>>(`/staff/season-years/${toYear}/clone-from/${fromYear}`, { method: "POST" }),
  createSeasonYear: (b: { season_year: number; starts_on: string; ends_on: string; notes?: string | null }) =>
    request(`/staff/season-years`, { method: "POST", body: JSON.stringify(b) }),
  districts: (year: number, geography?: string) =>
    request<DistrictRow>(`/staff/districts?year=${year}${geography ? `&geography=${geography}` : ""}`),
  districtDetail: (code: string, year: number, geography = "HD") =>
    request<DistrictDetail>(`/staff/districts/${code}/detail?year=${year}&geography=${geography}`),

  changePassword: (current_password: string, new_password: string) =>
    request("/staff/auth/change-password", { method: "POST", body: JSON.stringify({ current_password, new_password }) }),
  diff: (year: number) => request<DiffResultDto>(`/staff/season-years/${year}/diff`),
  publications: (year: number) => request<PublicationDto>(`/staff/publications?year=${year}`),
  /**
   * The regulations exactly as the public app reads them — the published snapshot at its
   * latest version — via the same public read endpoint the Engage MT app hits. Used by the
   * read-only Live-snapshot view so staff see what's served, not their working draft.
   */
  publishedRegulations: (year: number, species?: string) =>
    request<NormalizedRegulation>(
      `/fwp/hunting/regulations?season_year=${year}${species ? `&species=${species}` : ""}`,
    ),
  auditLog: async (opts: AuditLogQueryInput = {}): Promise<{ rows: AuditRow[]; nextCursor: string | null }> => {
    const env = await requestEnvelope<AuditRow>(`/staff/audit-log${auditLogSearch(opts)}`);
    return { rows: env.data ?? [], nextCursor: env.meta?.nextCursor ?? null };
  },
  /** Same-origin download link for the CSV export (approver+; cookie auth). */
  auditLogCsvUrl: (opts: AuditLogQueryInput = {}): string => `${BASE}/staff/audit-log.csv${auditLogSearch(opts)}`,
  users: () => request<UserRow>("/staff/users"),
  createUser: (email: string, display_name: string, role: string) =>
    request<{ user_id: string; temp_password: string }>("/staff/users", { method: "POST", body: JSON.stringify({ email, display_name, role }) }),
  resetUserPassword: (userId: string) =>
    request<{ temp_password: string }>(`/staff/users/${userId}/reset-password`, { method: "POST" }),
  patchUser: (userId: string, patch: { role?: string; display_name?: string; is_active?: boolean }) =>
    request(`/staff/users/${userId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  youthLens: (year: number, restr: "YOUTH_ONLY" | "PTHFV") =>
    request<OppLensRow>(`/staff/opportunities?year=${year}&restr_code=${restr}`),

  // ── Lookups (read-only; back the editing forms) ─────────────────────────────
  animalClasses: (species?: string) =>
    request<AnimalClassRow>(`/staff/animal-classes${species ? `?species=${species}` : ""}`),
  restrictionTypes: () => request<RestrictionTypeRow>("/staff/restriction-types"),
  portions: (districtId?: string) =>
    request<PortionRow>(`/staff/portions${districtId ? `?district_id=${districtId}` : ""}`),
  regions: () => request<RegionRow>("/staff/regions"),
  instruments: (year: number, opts?: { species?: string; q?: string }) =>
    request<InstrumentRow>(
      `/staff/instruments?year=${year}${opts?.species ? `&species=${opts.species}` : ""}${opts?.q ? `&q=${encodeURIComponent(opts.q)}` : ""}`,
    ),

  // Inline editors (optimistic-lock; expected_updated_at from the loaded row).
  patchInstrument: (id: string, patch: Record<string, unknown>) =>
    request(`/staff/instruments/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  createInstrument: (b: Record<string, unknown>) =>
    request<{ instrument_id: string }>("/staff/instruments", { method: "POST", body: JSON.stringify(b) }),
  createOpportunity: (b: Record<string, unknown>) =>
    request<{ opportunity_id: string }>("/staff/opportunities", { method: "POST", body: JSON.stringify(b) }),
  patchOpportunity: (id: string, patch: Record<string, unknown>) =>
    request(`/staff/opportunities/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  putWindows: (oppId: string, expected_updated_at: string, windows: WindowInputDto[]) =>
    request(`/staff/opportunities/${oppId}/windows`, { method: "PUT", body: JSON.stringify({ expected_updated_at, windows }) }),
  putRestrictions: (oppId: string, expected_updated_at: string, restrictions: RestrictionInputDto[]) =>
    request(`/staff/opportunities/${oppId}/restrictions`, { method: "PUT", body: JSON.stringify({ expected_updated_at, restrictions }) }),
  archiveOpportunity: (oppId: string, expected_updated_at: string) =>
    request(`/staff/opportunities/${oppId}/archive`, { method: "POST", body: JSON.stringify({ expected_updated_at }) }),
  restoreOpportunity: (oppId: string) =>
    request(`/staff/opportunities/${oppId}/restore`, { method: "POST" }),
  // Content + fees
  contentSections: (year: number, category?: string) =>
    request<ContentRow>(`/staff/content-sections?year=${year}${category ? `&category=${category}` : ""}`),
  contentSection: (id: string) => request<ContentRow>(`/staff/content-sections/${id}`),
  patchContent: (id: string, patch: Record<string, unknown>) =>
    request(`/staff/content-sections/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  createContent: (b: Record<string, unknown>) =>
    request<{ section_id: string }>("/staff/content-sections", { method: "POST", body: JSON.stringify(b) }),
  archiveContent: (id: string, expected_updated_at: string) =>
    request(`/staff/content-sections/${id}/archive`, { method: "POST", body: JSON.stringify({ expected_updated_at }) }),
  restoreContent: (id: string) =>
    request(`/staff/content-sections/${id}/restore`, { method: "POST" }),
  products: (year: number) => request<ProductRow>(`/staff/products?year=${year}`),
  createProduct: (b: Record<string, unknown>) =>
    request<{ product_id: string }>("/staff/products", { method: "POST", body: JSON.stringify(b) }),
  putPrices: (productId: string, expected_updated_at: string, prices: PriceInputDto[]) =>
    request(`/staff/products/${productId}/prices`, { method: "PUT", body: JSON.stringify({ expected_updated_at, prices }) }),

  // ── District notes ──────────────────────────────────────────────────────────
  createNote: (b: Record<string, unknown>) =>
    request<{ note_id: string }>("/staff/notes", { method: "POST", body: JSON.stringify(b) }),
  patchNote: (id: string, patch: Record<string, unknown>) =>
    request(`/staff/notes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  // ── Hunt areas / portions / restricted areas ────────────────────────────────
  huntAreas: (year: number) => request<HuntAreaRow>(`/staff/hunt-areas?year=${year}`),
  createHuntArea: (b: Record<string, unknown>) =>
    request<{ hunt_area_id: string }>("/staff/hunt-areas", { method: "POST", body: JSON.stringify(b) }),
  patchHuntArea: (id: string, patch: Record<string, unknown>) =>
    request(`/staff/hunt-areas/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  /** Current members of a hunt area — lets the Members editor pre-check its real districts. */
  huntAreaMembers: (id: string) => request<HuntAreaMemberRow>(`/staff/hunt-areas/${id}/members`),
  putHuntAreaMembers: (id: string, expected_updated_at: string, members: HuntAreaMemberDto[]) =>
    request(`/staff/hunt-areas/${id}/members`, { method: "PUT", body: JSON.stringify({ expected_updated_at, members }) }),
  repointHuntArea: (id: string, b: { to_hunt_area_id: string; opportunity_ids?: string[] | null }) =>
    request<{ moved: number }>(`/staff/hunt-areas/${id}/repoint`, { method: "POST", body: JSON.stringify(b) }),
  deleteHuntArea: (id: string) => request(`/staff/hunt-areas/${id}`, { method: "DELETE" }),
  createPortion: (b: Record<string, unknown>) =>
    request<{ portion_id: string }>("/staff/portions", { method: "POST", body: JSON.stringify(b) }),
  patchPortion: (id: string, patch: Record<string, unknown>) =>
    request(`/staff/portions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deletePortion: (id: string) => request(`/staff/portions/${id}`, { method: "DELETE" }),
  restrictedAreas: (year: number) => request<RareaRow>(`/staff/restricted-areas?year=${year}`),
  createRarea: (b: Record<string, unknown>) =>
    request<{ rarea_id: string }>("/staff/restricted-areas", { method: "POST", body: JSON.stringify(b) }),
  patchRarea: (id: string, patch: Record<string, unknown>) =>
    request(`/staff/restricted-areas/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteRarea: (id: string) => request(`/staff/restricted-areas/${id}`, { method: "DELETE" }),
  rareaDistricts: (id: string) => request<RareaLinkRow>(`/staff/restricted-areas/${id}/districts`),
  putRareaDistricts: (id: string, expected_updated_at: string, links: RareaLinkInputDto[]) =>
    request(`/staff/restricted-areas/${id}/districts`, { method: "PUT", body: JSON.stringify({ expected_updated_at, links }) }),

  // ── Important dates ─────────────────────────────────────────────────────────
  importantDates: (year: number) => request<ImportantDateRow>(`/staff/important-dates?year=${year}`),
  createImportantDate: (b: Record<string, unknown>) =>
    request<{ important_date_id: string }>("/staff/important-dates", { method: "POST", body: JSON.stringify(b) }),
  patchImportantDate: (id: string, patch: Record<string, unknown>) =>
    request(`/staff/important-dates/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteImportantDate: (id: string) => request(`/staff/important-dates/${id}`, { method: "DELETE" }),

  // ── Contacts ────────────────────────────────────────────────────────────────
  contacts: (year: number) => request<ContactRow>(`/staff/contacts?year=${year}`),
  createContact: (b: Record<string, unknown>) =>
    request<{ contact_id: string }>("/staff/contacts", { method: "POST", body: JSON.stringify(b) }),
  patchContact: (id: string, patch: Record<string, unknown>) =>
    request(`/staff/contacts/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteContact: (id: string) => request(`/staff/contacts/${id}`, { method: "DELETE" }),

  // ── CMS assets + region-map links ───────────────────────────────────────────
  assets: (kind?: string) => request<AssetRow>(`/staff/assets${kind ? `?kind=${kind}` : ""}`),
  createAsset: (b: Record<string, unknown>) =>
    request<{ asset_id: string }>("/staff/assets", { method: "POST", body: JSON.stringify(b) }),
  setRegionMap: (regionId: number, geography_code: string, asset_id: string) =>
    request(`/staff/regions/${regionId}/map-asset`, { method: "PUT", body: JSON.stringify({ geography_code, asset_id }) }),
};

export interface ContentRow { section_id: string; slug: string; category: string; title: string; body_md?: string; statute_refs: string | null; sort_order: number; record_status: string; updated_at: string; }
export interface ProductRow { product_id: string; product_code: string; display_name: string; product_kind: string; species_code: string | null; record_status: string; apply_by: string | null; chart_note: string | null; sort_order: number; updated_at: string; prices: Record<string, number>; }
export interface ImportantDateRow { important_date_id: string; date_code: string; date_kind: string; species_scope: string | null; label: string; starts_on: string | null; ends_on: string | null; note: string | null; sort_order: number; record_status: string; updated_at: string; }
export interface ContactRow { contact_id: string; contact_code: string; contact_kind: string; name: string; org: string | null; address: string | null; city: string | null; phone: string | null; phone2: string | null; email: string | null; url: string | null; region_id: number | null; note: string | null; sort_order: number; record_status: string; updated_at: string; }

export interface DiffResultDto {
  season_year: number;
  baseline_version: number | null;
  totals: { added: number; removed: number; changed: number };
  groups: { district_code: string; added: unknown[]; removed: unknown[]; changed: { rule_id: string; changes?: { field: string; before: unknown; after: unknown }[] }[] }[];
}
export interface PublicationDto {
  season_year: number;
  version: number;
  published_by: string;
  note: string | null;
  published_at: string;
  row_count: string;
  /** Correction metadata (0026) — present on v2+ publishes. */
  is_correction?: boolean;
  correction_summary?: string | null;
  affected_species?: string | null;
  affected_districts?: string | null;
}
export interface AuditRow { audit_id: string; table_name: string; row_pk: string | null; action_code: string; changed_by: string; changed_at: string; old_row_json: string | null; new_row_json: string | null; }
export interface UserRow { user_id: string; email: string; display_name: string; role: string; must_reset: number; is_active_flag: number; }
export interface HuntAreaRow { hunt_area_id: string; area_code: string; area_kind: string; definition_text: string | null; member_count: string; opportunity_count: string; updated_at: string; }
export interface RareaRow { rarea_id: string; area_type: string; area_name: string; legal_desc: string | null; district_count: string; updated_at: string; }
export interface RareaLinkRow { district_id: string; district_code: string; geography_code: string; note: string | null; }
/** A hunt area's member: either a full district or a district portion (never both). */
export interface HuntAreaMemberRow { member_seq: number; district_id: string | null; district_code: string | null; portion_id: string | null; portion_code: string | null; portion_name: string | null; }
export interface OppLensRow { opportunity_id: string; instr_code: string; instrument_name: string; species_code: string; legal_animal: string; district_code: string | null; }
export interface WindowInputDto { season_type_code: string; window_seq: number; starts_on: string; ends_on: string; raw_range?: string | null; }
export interface RestrictionInputDto { restr_code: string; value_text?: string | null; raw_text?: string | null; }
export interface PriceInputDto { audience_code: string; price_cents: number; price_note?: string | null; }
export interface HuntAreaMemberDto { district_id?: string | null; portion_id?: string | null; }
export interface RareaLinkInputDto { district_id: string; note?: string | null; }
