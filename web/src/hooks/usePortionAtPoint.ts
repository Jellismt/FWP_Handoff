/**
 * @file usePortionAtPoint.ts
 * @module engage-mt/hooks
 * @description Lookup hook for the FWP district PORTION(s) at a tapped point.
 *              Wraps `resolvePortionsAtPoint` so the hunting-district card can tell
 *              the hunter which sub-district area they tapped inside (e.g. "Portion
 *              of HD 314 South of Rock Creek"), and so the regs panel can emphasize
 *              that portion's rules. Returns `{ loading, portions }`; `portions` is
 *              [] until resolved and when the tap falls outside every portion (the
 *              common case). Never throws — a service miss resolves to []. Mirrors
 *              useWeaponRestrictionArea.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { resolvePortionsAtPoint, type PortionHit } from "@/services/spatialContext/resolvePortion";
import type { TapPoint } from "@/types/featureCard";

export interface UsePortionAtPointResult {
  loading: boolean;
  portions: PortionHit[];
}

/**
 * Resolve the portion(s) at `tapPoint`. No-ops (never loads) when `tapPoint` is
 * absent — programmatic renders (search hits) carry no tap point, so the card keeps
 * its whole-district behavior.
 */
export function usePortionAtPoint(tapPoint: TapPoint | undefined): UsePortionAtPointResult {
  const [state, setState] = useState<UsePortionAtPointResult>({
    loading: !!tapPoint,
    portions: [],
  });

  useEffect(() => {
    if (!tapPoint) {
      setState({ loading: false, portions: [] });
      return;
    }
    let cancelled = false;
    setState({ loading: true, portions: [] });
    void resolvePortionsAtPoint({
      latitude: tapPoint.latitude,
      longitude: tapPoint.longitude,
    }).then((portions) => {
      if (!cancelled) setState({ loading: false, portions });
    });
    return () => {
      cancelled = true;
    };
  }, [tapPoint]);

  return state;
}
