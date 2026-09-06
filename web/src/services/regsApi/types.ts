/**
 * @file types.ts
 * @module engage-mt/services/regsApi
 * @description Row shapes for the FWP Regs Manager public v2 API (/api/v2/fwp/hunting/*)
 *              plus the shared freshness envelope every fetcher returns. Field names mirror
 *              the API JSON exactly (snake_case) — see server/src/routes/publicV2Routes.ts.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export type RegsTier = "live" | "cached" | "field-copy" | "bundled";

export interface RegsFreshness {
  /** Where the rows came from: the API, the browser cache, a copy saved to the device, or the build. */
  tier: RegsTier;
  fetchedAt: string;
  sourceLabel: string;
  validUntil: string | null;
  /** Season effective date (YYYY-MM-DD). */
  effectiveDate: string | null;
  /** Published regulations version, when the source reports one. */
  version: number | null;
  /** validUntil has passed, or a stored copy is older than the stale window. */
  stale: boolean;
  /** Served from a stored copy (cached or field-copy) rather than the API. */
  fromCache: boolean;
  /** Served from the copy built into the app. */
  bundled: boolean;
}

/** Same shape under the name older call sites use. */
export type V2Freshness = RegsFreshness;

export interface V2Result<T> {
  data: T;
  freshness: RegsFreshness;
}

/** /hunting/important-dates — printed p.11 date tables + scattered windows. */
export interface ImportantDate {
  date_code: string;
  date_kind: "SEASON" | "DEADLINE" | "DRAWING_RESULT" | "REFUND" | "PURCHASE_WINDOW";
  species_scope: string | null;
  label: string;
  starts_on: string | null; // YYYY-MM-DD
  ends_on: string | null;
  note: string | null;
  sort_order: number;
}

/** /hunting/contacts — printed pp.143-144 + bear specialists (p.47). */
export interface HuntContact {
  contact_code: string;
  contact_kind:
    | "STATE_HQ"
    | "HOTLINE"
    | "REGIONAL_HQ"
    | "FIELD_OFFICE"
    | "STATE_AGENCY"
    | "FEDERAL"
    | "TRIBAL"
    | "BEAR_SPECIALIST";
  name: string;
  org: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  url: string | null;
  region_id: number | null;
  note: string | null;
  sort_order: number;
}

/** /hunting/content — list rows (body omitted; fetch per-slug). */
export interface ContentSection {
  slug: string;
  category: string;
  title: string;
  statute_refs: string | null;
  sort_order: number;
}

/** /hunting/content/:slug — full body. */
export interface ContentBody {
  slug: string;
  category: string;
  title: string;
  body_md: string;
  statute_refs: string | null;
}

/** /hunting/license-fees — one row per product, prices keyed by audience code. */
export interface LicenseFee {
  code: string;
  name: string;
  kind: string;
  species: string | null;
  applyBy: string | null;
  note: string | null;
  prices: Record<string, { cents: number; note: string | null }>;
}

/** /hunting/restricted-areas — printed pp.28-30 + district links. */
export interface RestrictedArea {
  area_type: string;
  area_name: string;
  legal_desc: string | null;
  districts: string[];
}

/** /hunting/youth-opportunities — derived youth/PTHFV rows per district. */
export interface YouthOpportunity {
  geography_code: string;
  district_code: string;
  species_code: string;
  license: string;
  opportunity: string;
  validity_note: string | null;
  restriction_codes: string;
}

/** /hunting/district-notes — per-district NOTEs (CWD sampling, closures, phones). */
export interface DistrictNotes {
  district_code: string;
  geography_code: string;
  notes: string[];
}
