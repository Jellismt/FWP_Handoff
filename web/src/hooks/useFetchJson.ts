/**
 * @file useFetchJson.ts
 * @module engage-mt/hooks
 * @description Tier-2 JSON fetch hook. Pairs `fetchJson` (typed-error + timeout
 *              wrapper from utils/http.ts) with React state so list-explorer
 *              pages get a uniform `{ data, error, loading, retry }` surface
 *              instead of each page hand-rolling fetch + alive-flag + retry +
 *              error state.
 *
 * Extracted from the list-explorer
 *              pages, which all shared the same
 *              fetch+filter+error pattern. Re-fetching is opt-in via `retry()`;
 *              passing a new `url` re-fetches automatically (e.g. for paginated
 *              filters).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-06-02
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { fetchJson } from "@/utils/http";

export interface UseFetchJsonResult<T> {
  /** Resolved JSON payload, or `null` while loading / on error. */
  data: T | null;
  /** Last thrown error (typed via utils/errors), or `null`. */
  error: unknown | null;
  /** `true` while the request is in flight (i.e. neither data nor error yet). */
  loading: boolean;
  /** Force a re-fetch — bumps an internal load-key the effect depends on. */
  retry: () => void;
}

export function useFetchJson<T>(url: string): UseFetchJsonResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    fetchJson<T>(url)
      .then((rows) => {
        if (alive) setData(rows);
      })
      .catch((err: unknown) => {
        if (alive) setError(err);
      });
    return () => {
      alive = false;
    };
  }, [url, loadKey]);

  return {
    data,
    error,
    loading: data === null && error === null,
    retry: () => setLoadKey((k) => k + 1),
  };
}
