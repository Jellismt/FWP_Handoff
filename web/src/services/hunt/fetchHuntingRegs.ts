/**
 * @file fetchHuntingRegs.ts
 * @module engage-mt/services/hunt
 * @description The unified deer/elk/antelope regulations table from the v1
 *              public API, served through the shared regs fetcher so it gets
 *              the same stored-copy and built-in fallbacks as every other
 *              regulations dataset.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-20
 * @updated 2026-09-06
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { NormalizedRegulation } from "./regsTypes";
import {
  RegsApiUnavailableError,
  createRegsFetcher,
  resetRegsApiCache,
} from "@/services/regsApi/client";
import type { RegsFreshness } from "@/services/regsApi/types";
import { currentRegsYear } from "@/services/regsApi/year";

export type { RegsFreshness } from "@/services/regsApi/types";

export const HUNTING_REGS_SLUG = "hunting-regulations-unified";

export { RegsApiUnavailableError as RegsUnavailableError };

export interface RegsResult {
  rows: NormalizedRegulation[];
  freshness: RegsFreshness;
}

const fetchUnified = createRegsFetcher<NormalizedRegulation[]>({
  api: "v1",
  path: () => `/datasets/${HUNTING_REGS_SLUG}`,
  cacheKey: () => HUNTING_REGS_SLUG,
  label: () => "FWP hunting regulations",
});

export async function fetchHuntingRegs(force = false): Promise<RegsResult> {
  const result = await fetchUnified(currentRegsYear(), force);
  return {
    rows: Array.isArray(result.data) ? result.data : [],
    freshness: result.freshness,
  };
}

export const resetHuntingRegsCache = resetRegsApiCache;
