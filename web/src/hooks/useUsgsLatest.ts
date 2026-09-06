/**
 * @file useUsgsLatest.ts
 * @module engage-mt/hooks
 * @description React hook around fetchLatestObservations with loading/error state.
 *              Exposes `fromCache` + `observedAt` so cards can stamp a last-good
 *              reading served offline instead of showing an empty card.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-14
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import {
  fetchLatestObservationsCached,
  type UsgsObservation,
  type UsgsParam,
} from "@/services/public/usgsWaterServices";

interface State {
  loading: boolean;
  error: Error | null;
  observations: UsgsObservation[];
  /** True when the readings came from the last-good offline snapshot. */
  fromCache: boolean;
  /** ISO — the reading's observation time (or when it was cached). */
  observedAt: string | null;
}

const EMPTY: State = {
  loading: false,
  error: null,
  observations: [],
  fromCache: false,
  observedAt: null,
};

export const useUsgsLatest = (
  siteCodes: readonly string[],
  params: readonly UsgsParam[],
): State => {
  const [state, setState] = useState<State>({ ...EMPTY, loading: true });
  // Stable cache key
  const key = `${siteCodes.join(",")}::${params.join(",")}`;
  useEffect(() => {
    let alive = true;
    setState({ ...EMPTY, loading: true });
    if (siteCodes.length === 0) {
      setState(EMPTY);
      return undefined;
    }
    (async () => {
      try {
        const result = await fetchLatestObservationsCached(siteCodes, params);
        if (alive)
          setState({
            loading: false,
            error: null,
            observations: result.observations,
            fromCache: result.fromCache,
            observedAt: result.observedAt,
          });
      } catch (err) {
        if (alive)
          setState({
            ...EMPTY,
            error: err instanceof Error ? err : new Error(String(err)),
          });
      }
    })();
    return () => {
      alive = false;
    };
    // `key` is a stable hash of (siteCodes, params); listing the
    // underlying arrays would re-fire on every new array identity even
    // when contents match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
};
