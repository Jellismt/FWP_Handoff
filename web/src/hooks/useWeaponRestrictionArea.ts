/**
 * @file useWeaponRestrictionArea.ts
 * @module engage-mt/hooks
 * @description Lookup hook for the FWP big-game weapon-restriction area (if any)
 *              at a tapped point. Wraps `resolveWeaponRestrictionAtPoint` so the
 *              hunting-district card can surface the restricted area's verbatim
 *              `PORTIONNAME` + `COMMENTS` when the user taps inside one, instead
 *              of the district-level boilerplate note.
 *
 *              Returns `{ loading, area }`. `area` is null until resolved and
 *              when the tap falls outside every restricted-area polygon (the
 *              common case — most of a district is unrestricted). The lookup
 *              never throws; a service miss resolves to null.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-08
 * @updated 2026-07-08
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import {
  resolveWeaponRestrictionAtPoint,
  type RestrictedArea,
} from "@/services/public/weaponRestriction";
import type { TapPoint } from "@/types/featureCard";

export interface UseWeaponRestrictionAreaResult {
  loading: boolean;
  area: RestrictedArea | null;
}

/**
 * Resolve the weapon-restriction area at `tapPoint`. No-ops (never loads) when
 * `tapPoint` is absent — programmatic renders (search hits, takeover-from-search)
 * carry no tap point, so the card keeps its district-level note.
 */
export function useWeaponRestrictionArea(
  tapPoint: TapPoint | undefined,
): UseWeaponRestrictionAreaResult {
  const [state, setState] = useState<UseWeaponRestrictionAreaResult>({
    loading: !!tapPoint,
    area: null,
  });

  useEffect(() => {
    if (!tapPoint) {
      setState({ loading: false, area: null });
      return;
    }
    let cancelled = false;
    setState({ loading: true, area: null });
    void resolveWeaponRestrictionAtPoint({
      latitude: tapPoint.latitude,
      longitude: tapPoint.longitude,
    }).then((area) => {
      if (!cancelled) setState({ loading: false, area });
    });
    return () => {
      cancelled = true;
    };
  }, [tapPoint]);

  return state;
}
