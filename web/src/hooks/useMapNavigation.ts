/**
 * @file useMapNavigation.ts
 * @module engage-mt/hooks
 * @description Convenience hook for "fly the map to a point" from anywhere in the app.
 *              Pushes a target to mapNavStore + (optionally) navigates to the map route
 *              first so the MapView is mounted when the goto fires.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMapNavStore, type MapNavTarget } from "@/store/map/mapNavStore";

interface UseMapNavigationApi {
  /**
   * Fly the map to a point.
   * Routes the user to `/` first if `route` is not `false`, so the MapView mounts
   * before the goTo fires.
   */
  flyTo: (target: MapNavTarget, opts?: { route?: false }) => void;
}

export const useMapNavigation = (): UseMapNavigationApi => {
  const navigate = useNavigate();
  const requestGoto = useMapNavStore((s) => s.requestGoto);

  const flyTo = useCallback(
    (target: MapNavTarget, opts?: { route?: false }) => {
      if (opts?.route !== false) {
        navigate("/");
      }
      requestGoto({ zoom: 13, ...target });
    },
    [navigate, requestGoto],
  );

  return { flyTo };
};
