/**
 * @file useAsyncState.ts
 * @module engage-mt/hooks
 * @description Unifies the loading / error / empty / success state
 *              machine consumed by `<AsyncBoundary>`. Eliminates the
 *              4-different-ways-to-handle-async drift surfaced by the
 *              design-polish audit (14 pages with bare `<p>Loading…</p>`,
 *              ~20 explorers failing silently).
 *
 *              Use `useAsyncState({ fetcher, isEmpty, deps })` and feed
 *              the returned `state` + `retry` into `<AsyncBoundary>`.
 *              Pages get one consistent pattern the lint rules
 *              can verify.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-17
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncStatus = "loading" | "error" | "empty" | "success";

export type AsyncState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "error"; data: null; error: unknown }
  | { status: "empty"; data: T; error: null }
  | { status: "success"; data: T; error: null };

interface UseAsyncStateOpts<T> {
  /** Async fetcher invoked on mount + whenever deps change. */
  fetcher: () => Promise<T>;
  /** Optional predicate; when true the resolved value is reported as `empty`. */
  isEmpty?: (data: T) => boolean;
  /** Dependency array that retriggers the fetch (shallow-compared). */
  deps?: ReadonlyArray<unknown>;
}

export interface UseAsyncStateResult<T> {
  state: AsyncState<T>;
  /** Re-runs the fetcher (used by the AsyncBoundary error CTA). */
  retry: () => void;
}

/**
 * Tracks the loading/error/empty/success machine for a single fetcher.
 * The fetcher's last-in-wins via a sequence number so a quick retry
 * doesn't paint an older response over a newer one.
 */
export const useAsyncState = <T>({
  fetcher,
  isEmpty,
  deps = [],
}: UseAsyncStateOpts<T>): UseAsyncStateResult<T> => {
  const [state, setState] = useState<AsyncState<T>>({
    status: "loading",
    data: null,
    error: null,
  });
  const seqRef = useRef(0);
  const [tick, setTick] = useState(0);

  const retry = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const seq = ++seqRef.current;
    let cancelled = false;
    setState({ status: "loading", data: null, error: null });
    fetcher()
      .then((data) => {
        if (cancelled || seq !== seqRef.current) return;
        const empty = isEmpty ? isEmpty(data) : false;
        setState(
          empty ? { status: "empty", data, error: null } : { status: "success", data, error: null },
        );
      })
      .catch((error: unknown) => {
        if (cancelled || seq !== seqRef.current) return;
        setState({ status: "error", data: null, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { state, retry };
};
