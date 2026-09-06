/**
 * @file api.ts
 * @module engage-mt/shared
 * @description REST envelope + error contract. Documented in docs/regs-manager/api.md.
 *              Every public endpoint returns `{data, meta, warnings, errors}`; the compat
 *              /datasets endpoint the web app cuts over to unwraps `data`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { z } from "zod";

export const REGS_SCHEMA_VERSION = "1.0";

/** Standard error codes per the REST conventions doc. */
export const API_ERROR_CODES = [
  "INVALID_PARAM",
  "NOT_FOUND",
  "CONFLICT",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "UPSTREAM_DOWN",
  "INTERNAL",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  field?: string;
  received?: unknown;
}

export interface EnvelopeMeta {
  schemaVersion: string;
  count: number;
  totalCount?: number;
  offset?: number;
  limit?: number;
  effectiveFrom?: string;
  validUntil?: string;
  generatedAt: string;
  etag?: string;
  sourceLabel?: string;
  /** Published regulations version the rows came from. */
  version?: number;
  filters?: Record<string, unknown>;
  /** Keyset cursor for the next page, or null when this page is the last. */
  nextCursor?: string | null;
}

/** The response envelope. `data` is null only on hard error. */
export interface Envelope<T> {
  data: T[] | null;
  meta: EnvelopeMeta | null;
  warnings?: string[];
  errors?: ApiError[];
}

/** Build a success envelope. */
export function ok<T>(
  data: T[],
  meta: Omit<EnvelopeMeta, "schemaVersion" | "count"> &
    Partial<Pick<EnvelopeMeta, "schemaVersion" | "count">>,
): Envelope<T> {
  return {
    data,
    meta: {
      schemaVersion: REGS_SCHEMA_VERSION,
      count: data.length,
      ...meta,
    },
    warnings: [],
    errors: [],
  };
}

/** Build an error envelope. */
export function fail(errors: ApiError[]): Envelope<never> {
  return { data: null, meta: null, errors };
}

/** Common paging query params. */
export const pagingQuerySchema = z.object({
  offset: z.coerce.number().int().gte(0).default(0),
  limit: z.coerce.number().int().gte(1).lte(1000).default(100),
});
