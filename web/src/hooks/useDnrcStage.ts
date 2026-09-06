/**
 * @file useDnrcStage.ts
 * @module engage-mt/hooks
 * @description React hook around `fetchDnrcStage` — resolves live discharge,
 *              water temperature, gage height, daily series, and current-month
 *              normals for a Montana DNRC StAGE station by its `LocationCode`.
 *              Mirrors the loading/error/alive-flag ergonomics of
 *              `useUsgsLatest` so the gage card composes identically regardless
 *              of source. Null `locationCode` → idle empty state (used for
 *              programmatic / non-DNRC renders).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { fetchDnrcStage, type DnrcStage } from "@/services/hydrology/dnrcStageClient";

interface State {
  loading: boolean;
  error: Error | null;
  data: DnrcStage | null;
}

export const useDnrcStage = (locationCode: string | null): State => {
  const [state, setState] = useState<State>({ loading: true, error: null, data: null });
  useEffect(() => {
    let alive = true;
    if (!locationCode) {
      setState({ loading: false, error: null, data: null });
      return () => {
        alive = false;
      };
    }
    setState({ loading: true, error: null, data: null });
    (async () => {
      try {
        const data = await fetchDnrcStage(locationCode);
        if (alive) setState({ loading: false, error: null, data });
      } catch (err) {
        if (alive)
          setState({
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
            data: null,
          });
      }
    })();
    return () => {
      alive = false;
    };
  }, [locationCode]);
  return state;
};
