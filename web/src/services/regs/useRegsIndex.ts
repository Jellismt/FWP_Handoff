/**
 * @file useRegsIndex.ts
 * @module engage-mt/services/regs
 * @description Loads `/regs/regs-index.json` (metadata for the FWP regulation
 *              documents) once per session and exposes a lookup for the citation
 *              chip + source links. The documents themselves are NOT bundled —
 *              links point at FWP's canonical online copy (`FWP_REGS_URL`).
 *              Pattern mirrors useFetchJson but caches at the module level — the
 *              regs index doesn't change at runtime.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-15
 * @version 1.1.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { fetchJson } from "@/utils/http";

/**
 * FWP's canonical, always-current hunting-regulations page. Source links + PDF
 * citations point here rather than a bundled snapshot, so they never go stale
 * across the yearly regs cycle and add no weight to the app bundle.
 */
export const FWP_REGS_URL = "https://fwp.mt.gov/hunt/regulations";

/**
 * Resolve a regs-document reference to a loadable URL. Absolute `http(s)` inputs
 * (the canonical FWP URL, or a per-entry `onlineUrl`) pass through unchanged on
 * every platform; a bare relative path is returned as-is. Kept as the single
 * seam every regs link routes through.
 */
export function regsPdfPath(relativeOrAbsolute: string): string {
  return relativeOrAbsolute;
}

/** Provenance block every PDF-extracted dataset row carries. */
export interface SourceBlock {
  /** regs-index.json id, e.g. "dea-regs-2026". */
  regId: string;
  /** 1-based PDF page where the row was extracted. */
  page: number;
  /** F&W Commission adoption date (ISO YYYY-MM-DD), null if N/A. */
  commissionAdoptedAt: string | null;
  /** Last day the citation is current, null if no expiration. */
  validUntil: string | null;
  /** Build timestamp (ISO). */
  extractedAt: string;
  /** Extractor script + version, e.g. "build_regs_snapshot.mjs@1.0.0". */
  extractor: string;
  /** True when this row came from overrides/*.yaml instead of automated parsing. */
  override: boolean;
}

export interface RegMetadata {
  id: string;
  filename: string;
  title: string;
  subtitle?: string;
  publisher: string;
  regionalContact?: {
    office?: string;
    phone?: string;
    biologist?: string;
    email?: string;
  };
  pageCount: number;
  commissionAdoptedAt: string | null;
  effectiveFrom: string;
  validUntil: string | null;
  /** Local bundled path, e.g. "/regs/dea-2026.pdf". */
  url: string;
  /** Optional canonical hosted URL (e.g. an fwp.mt.gov absolute link). When
   *  present it wins over rewriting `url` against the online base. */
  onlineUrl?: string;
  scope: readonly string[];
  note?: string;
}

interface RegsIndex {
  _meta: {
    schemaVersion: string;
    description: string;
    regenerated: string;
  };
  regs: readonly RegMetadata[];
}

// Module-level cache so every consumer shares one fetch.
let cached: RegsIndex | null = null;
let pending: Promise<RegsIndex> | null = null;

async function load(): Promise<RegsIndex> {
  if (cached) return cached;
  if (!pending) {
    // Routed through the sanctioned fetch surface (`http.ts`) for the shared
    // timeout / abort / typed-error mapping. The module-level cache + pending
    // dedup stays — the regs index doesn't change at runtime, so one fetch
    // serves every consumer.
    pending = fetchJson<RegsIndex>("/regs/regs-index.json")
      .then((idx) => {
        cached = idx;
        return idx;
      })
      .catch((err) => {
        // Clear the in-flight promise so a later mount can retry the fetch.
        pending = null;
        throw err;
      });
  }
  return pending;
}

/** Hook for components — returns the index, loading flag, error. */
export function useRegsIndex(): {
  index: RegsIndex | null;
  loading: boolean;
  error: unknown | null;
} {
  const [state, setState] = useState<{
    index: RegsIndex | null;
    loading: boolean;
    error: unknown | null;
  }>({ index: cached, loading: !cached, error: null });

  useEffect(() => {
    if (cached) {
      setState({ index: cached, loading: false, error: null });
      return;
    }
    let alive = true;
    load()
      .then((idx) => {
        if (alive) setState({ index: idx, loading: false, error: null });
      })
      .catch((err) => {
        if (alive) setState({ index: null, loading: false, error: err });
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

/** Synchronous lookup once the index is loaded. Returns null on cache miss. */
export function findReg(regId: string): RegMetadata | null {
  if (!cached) return null;
  return cached.regs.find((r) => r.id === regId) ?? null;
}

/**
 * Build the deep-link URL that opens the PDF at a specific page in a new tab.
 * Browsers honor `#page=N` for inline PDF viewers (Chrome/Edge/Safari).
 */
export function buildPdfDeepLink(source: SourceBlock): string | null {
  const meta = findReg(source.regId);
  if (!meta) return null;
  return `${regsPdfPath(meta.onlineUrl ?? meta.url)}#page=${source.page}`;
}
