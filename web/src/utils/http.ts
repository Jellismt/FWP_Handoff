/**
 * @file http.ts
 * @module engage-mt/utils
 * @description fetch wrapper that normalizes failures to typed Engage-MT errors.
 *.
 *                - Default timeout raised 15s → 30s to accommodate slow
 *                  rural/mobile networks (Montana coverage realities).
 *                - `withBackoff` helper retries 429/network failures with
 *                  exponential delay + jitter, honoring `Retry-After` when
 *                  the server sends one.
 *
 *              This module is the ONLY sanctioned external-fetch surface.
 *              `fetchJson` / `fetchText` carry the AbortController timeout +
 *              per-service overrides + typed-error mapping; `withBackoff` is
 *              the ONE canonical retry path. Do not reintroduce a bare
 *              `fetch()` in a service, and do not add a parallel retry helper.
 *              Every public-service fetch is routed here; a caller-supplied `signal`
 *              is merged with the timeout so cancellation still works.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.4.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { AuthError, DataError, NetworkError, NotFoundError, RateLimitError } from "./errors";

interface FetchJsonOptions extends RequestInit {
  /** Total timeout in milliseconds (default: 30s). */
  timeoutMs?: number;
}

/**
 * Default total-fetch timeout. Raised from 15s in Montana's rural
 * cell coverage + slow public-agency endpoints (DNRC, USGS, NRCS) made the
 * old budget bite users on legitimate slow connections.
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Per-service overrides for endpoints known to be slow under load. Keyed by
 * URL prefix. Add an entry when a specific upstream needs more headroom than
 * the default; document the reason inline.
 */
const SERVICE_TIMEOUT_OVERRIDES: ReadonlyArray<{
  prefix: string;
  timeoutMs: number;
  reason: string;
}> = [
  {
    // DNRC StAGE is a small VM that warms up cold on first request.
    prefix: "https://gis.dnrc.mt.gov/",
    timeoutMs: 45000,
    reason: "DNRC StAGE cold-start warmup",
  },
  {
    // USGS NWIS occasionally takes >10s under peak load.
    prefix: "https://waterservices.usgs.gov/",
    timeoutMs: 45000,
    reason: "USGS NWIS peak-load tolerance",
  },
];

const resolveTimeout = (url: string, explicit: number | undefined): number => {
  if (explicit !== undefined) return explicit;
  const match = SERVICE_TIMEOUT_OVERRIDES.find((o) => url.startsWith(o.prefix));
  return match?.timeoutMs ?? DEFAULT_TIMEOUT;
};

/**
 * Shared request core for `fetchJson` / `fetchText`. Applies the resolved
 * timeout via an internal AbortController, MERGES a caller-supplied `signal`
 * (so a caller's cancellation still works — the timeout no longer clobbers
 * it), maps non-OK statuses to typed errors, and OWNS the body decode.
 *
 * CO-3: the decode runs INSIDE the timeout/abort coverage. Previously the
 * timer was cleared the moment `fetch()` resolved headers, so a slow or
 * never-closing response body (`.json()` / `.text()`) hung unbounded and
 * un-abortable — defeating this module's whole reason to exist (the one
 * hang-proof fetch surface). The `decode` callback lets each public helper
 * pick its body reader while sharing the timeout + caller-abort + typed-error
 * machinery.
 */
const fetchOk = async <T>(
  url: string,
  options: FetchJsonOptions,
  decode: (response: Response) => Promise<T>,
): Promise<T> => {
  const { timeoutMs, signal: callerSignal, ...init } = options;
  const totalTimeout = resolveTimeout(url, timeoutMs);
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, totalTimeout);

  // Merge the caller's signal with the timeout signal: if either aborts, the
  // request aborts. Done manually (not via AbortSignal.any) for happy-dom +
  // older-runtime compatibility.
  let onCallerAbort: (() => void) | undefined;
  if (callerSignal) {
    if (callerSignal.aborted) ctrl.abort();
    else {
      onCallerAbort = () => ctrl.abort();
      callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }
  }

  try {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: ctrl.signal });
    } catch (err) {
      // A caller-initiated abort is terminal — rethrow the AbortError so callers
      // (and `withBackoff`) treat it as cancellation, not a retryable failure.
      // A timeout is transient: surface it as a retryable NetworkError.
      if (callerSignal?.aborted && !timedOut) throw err;
      if (timedOut) throw new NetworkError(`Timed out reaching ${url}`, err);
      throw new NetworkError(`Could not reach ${url}`, err);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthError(`Auth required for ${url}`);
      }
      if (response.status === 404) {
        throw new NotFoundError(`${url} not found`);
      }
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const seconds = retryAfter ? Number(retryAfter) : undefined;
        throw new RateLimitError(`Rate limited at ${url}`, seconds);
      }
      throw new NetworkError(`${url} returned ${response.status}`);
    }

    // Body decode under the same coverage (CO-3).
    try {
      return await decode(response);
    } catch (err) {
      // Same abort/timeout distinction as the header phase: caller-abort is
      // terminal, a timeout mid-body is a retryable NetworkError, and a real
      // decode failure (malformed JSON, read error) is a DataError.
      if (callerSignal?.aborted && !timedOut) throw err;
      if (timedOut) throw new NetworkError(`Timed out reading body from ${url}`, err);
      throw new DataError(`Could not read response body from ${url}`, err);
    }
  } finally {
    clearTimeout(timer);
    if (callerSignal && onCallerAbort) callerSignal.removeEventListener("abort", onCallerAbort);
  }
};

export const fetchJson = <T>(url: string, options: FetchJsonOptions = {}): Promise<T> =>
  fetchOk<T>(url, options, (response) => response.json() as Promise<T>);

/**
 * Text counterpart of `fetchJson` — same timeout / override / abort /
 * typed-error machinery, but resolves the raw response body as a string.
 * Used for XML and other non-JSON upstreams (e.g. NWS AHPS hydrograph XML).
 */
export const fetchText = (url: string, options: FetchJsonOptions = {}): Promise<string> =>
  fetchOk<string>(url, options, (response) => response.text());

/**
 * Run an ArcGIS REST query URL (`…/FeatureServer/N/query?…`) and return the
 * parsed JSON, or `null` on ANY failure path — timeout, HTTP error,
 * caller-abort, JSON parse error, OR an ArcGIS `{ error: … }` envelope (which
 * ArcGIS returns with a 200 status). Consolidates the identical
 * AbortController + timeout + caller-signal merge that the high-frequency
 * tap-query helpers (`queryAttributesAtPoint`, `queryNearbyFeatures`,
 * `aggregateSurveysAtPoint`) each hand-rolled. Reuses `fetchJson`'s timeout +
 * caller-signal machinery; deliberately NO retry — tap handlers must fail fast
 * and degrade to "no data here." Callers own the shape extraction. Returning
 * `null` (not throwing) matches the partial-data tolerance in
 * `docs/rules/feature-cards.md`.
 */
export const fetchArcgisQuery = async <T>(
  queryUrl: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T | null> => {
  try {
    const json = await fetchJson<T>(queryUrl, options);
    if (json && typeof json === "object" && (json as { error?: unknown }).error) return null;
    return json;
  } catch {
    return null;
  }
};

interface BackoffOptions {
  /** Maximum number of attempts INCLUDING the first try. Default 3. */
  maxAttempts?: number;
  /** Base delay in ms; doubles each retry. Default 1000ms. */
  baseDelayMs?: number;
  /** Max delay cap in ms; protects against pathological `Retry-After`. Default 30s. */
  maxDelayMs?: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wrap any async producer with exponential backoff on transient failures
 * (`RateLimitError`, `NetworkError`). `AuthError` / `NotFoundError` /
 * `DataError` are NOT retried — they're permanent. Honors `RateLimitError.retryAfterSeconds`
 * when set, capped at `maxDelayMs`. Adds ±25% jitter to avoid thundering-herd.
 *
 * Use sparingly — most fetches should fail fast and let React Query / hooks
 * decide whether to retry. Reserve this for known-flaky upstreams (USGS NWIS
 * during peaks, DNRC during cold starts).
 */
export const withBackoff = async <T>(
  producer: () => Promise<T>,
  options: BackoffOptions = {},
): Promise<T> => {
  const { maxAttempts = 3, baseDelayMs = 1000, maxDelayMs = 30000 } = options;
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < maxAttempts) {
    try {
      return await producer();
    } catch (err) {
      lastErr = err;
      const isRetriable = err instanceof RateLimitError || err instanceof NetworkError;
      if (!isRetriable || attempt === maxAttempts - 1) throw err;
      let delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      if (err instanceof RateLimitError && err.retryAfterSeconds) {
        delay = Math.min(err.retryAfterSeconds * 1000, maxDelayMs);
      }
      // ±25% jitter
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      await sleep(Math.max(0, delay + jitter));
      attempt += 1;
    }
  }
  throw lastErr;
};
