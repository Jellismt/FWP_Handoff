/**
 * @file OfflineBanner.tsx
 * @module engage-mt/shared/notices
 * @description Shown while the device is offline. On the device, when the map
 *              has been panned outside every downloaded area, it says so and
 *              offers to jump to the nearest one.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { CalciteNotice } from "@esri/calcite-components-react";
import { useConnectivityStore } from "@/store/app/connectivityStore";
import { useOfflineCoverageStore } from "@/store/map/offlineCoverageStore";
import { useMapNavigation } from "@/hooks/useMapNavigation";
import { bboxCenter } from "@/services/mobile/offlineTileResolver";
import "./OfflineBanner.css";

const NEAREST_AREA_ZOOM = 11;

export const OfflineBanner = (): JSX.Element | null => {
  const online = useConnectivityStore((s) => s.online);
  const inCoverage = useOfflineCoverageStore((s) => s.inCoverage);
  const nearest = useOfflineCoverageStore((s) => s.nearest);
  const { flyTo } = useMapNavigation();
  if (online) return null;

  const outside = inCoverage === false && nearest !== null;
  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <CalciteNotice open icon="offline" kind="warning" scale="s">
        <div slot="title">
          {outside ? "You're offline and outside your downloaded areas" : "You're offline"}
        </div>
        <div slot="message">
          {outside ? (
            <>
              The map has no tiles here. Your nearest download is {nearest.label}.{" "}
              <button
                type="button"
                className="offline-banner__action"
                onClick={() => {
                  const c = bboxCenter(nearest.bbox);
                  flyTo({ lat: c.lat, lon: c.lon, zoom: NEAREST_AREA_ZOOM });
                }}
              >
                Show {nearest.label}
              </button>
            </>
          ) : (
            <>
              For areas you downloaded, the map, land ownership, and districts still work — tap the
              map to identify them. Live values (flows, temps, alerts) show the last reading and may
              be out of date until you reconnect.
            </>
          )}
        </div>
      </CalciteNotice>
    </div>
  );
};
