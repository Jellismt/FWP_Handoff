/**
 * @file NearbyPublicAccessBlock.tsx
 * @module engage-mt/map/featureCards/enrichments
 * @description For private cadastral hits + tribal hits, the
 *              card always answers "you can't be here without permission."
 *              This block answers the obvious follow-up: "OK, what *can*
 *              I do nearby?" It queries the two core public-access
 *              layers (BMA, FAS) within a 5-mile radius and lists
 *              up to 3 of each that are closest to the click.
 *
 *              Both queries run in parallel + degrade independently.
 *              When both return zero hits the block renders nothing
 *              — better silence than a misleading empty section.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { ListCard } from "@/components/map/featureCards/core/cardPrimitives";
import type { TapPoint } from "@/components/map/featureCards/core/types";
import { queryNearbyFeatures } from "@/services/spatialContext/nearby";
import { getLayerUrl } from "@/config/layers";

interface Props {
  tapPoint?: TapPoint;
  /** Radius in miles. Defaults to 5 — tunable per card. */
  radiusMiles?: number;
  /** Max per layer. Defaults to 3. */
  perLayerLimit?: number;
}

interface NearbyRow {
  label: string;
  value: string;
}

const BMA_URL = getLayerUrl("bma-boundaries");
const FAS_URL = getLayerUrl("fishing-access-sites");

const formatDistance = (miles: number): string =>
  miles < 0.1 ? "< 0.1 mi" : `${miles.toFixed(1)} mi`;

export const NearbyPublicAccessBlock = ({
  tapPoint,
  radiusMiles = 5,
  perLayerLimit = 3,
}: Props): JSX.Element | null => {
  const [bmaRows, setBmaRows] = useState<NearbyRow[]>([]);
  const [fasRows, setFasRows] = useState<NearbyRow[]>([]);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!tapPoint) return;
    const p = { longitude: tapPoint.longitude, latitude: tapPoint.latitude };
    let cancelled = false;

    void Promise.allSettled([
      queryNearbyFeatures({
        url: BMA_URL,
        longitude: p.longitude,
        latitude: p.latitude,
        distanceMiles: radiusMiles,
        outFields: ["BMANAME", "BMA_NAME", "NAME", "Name", "bma_name"],
        limit: perLayerLimit,
      }),
      queryNearbyFeatures({
        url: FAS_URL,
        longitude: p.longitude,
        latitude: p.latitude,
        distanceMiles: radiusMiles,
        outFields: ["SITENAME", "Name", "NAME"],
        limit: perLayerLimit,
      }),
    ]).then(([bma, fas]) => {
      if (cancelled) return;
      const toRows = (
        r: PromiseSettledResult<Awaited<ReturnType<typeof queryNearbyFeatures>>>,
        nameKeys: readonly string[],
      ): NearbyRow[] => {
        if (r.status !== "fulfilled") return [];
        return r.value.map((hit) => {
          const a = hit.attributes;
          let name = "(unnamed)";
          for (const k of nameKeys) {
            const v = a[k];
            if (typeof v === "string" && v.length > 0) {
              name = v;
              break;
            }
          }
          return {
            label: name,
            value: formatDistance(hit.distanceMiles),
          };
        });
      };

      setBmaRows(toRows(bma, ["BMANAME", "BMA_NAME", "NAME", "Name", "bma_name"]));
      setFasRows(toRows(fas, ["SITENAME", "Name", "NAME"]));
      setResolved(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapPoint?.latitude, tapPoint?.longitude, radiusMiles, perLayerLimit]);

  if (!tapPoint) return null;
  if (!resolved) return null;
  if (bmaRows.length === 0 && fasRows.length === 0) {
    return null;
  }

  return (
    <div aria-live="polite">
      {bmaRows.length > 0 && (
        <ListCard title={`Nearby BMAs (within ${radiusMiles} mi)`} rows={bmaRows} />
      )}
      {fasRows.length > 0 && (
        <ListCard title={`Nearby fishing access sites (within ${radiusMiles} mi)`} rows={fasRows} />
      )}
    </div>
  );
};
