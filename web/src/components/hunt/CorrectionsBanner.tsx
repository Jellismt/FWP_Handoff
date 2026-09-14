/**
 * @file CorrectionsBanner.tsx
 * @module engage-mt/hunt
 * @description Tells a district page about mid-season corrections. A
 *              correction newer than the version being shown is a warning
 *              (this copy does not have it); corrections the shown version
 *              already includes are listed as information. Renders nothing
 *              when no correction touches the district or the feed cannot be
 *              read.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { TipBlock } from "@/components/map/featureCards/core/cardPrimitives";
import {
  affectsDistrict,
  fetchCorrections,
  splitCorrections,
  type RegsCorrection,
} from "@/services/regsApi/corrections";

interface CorrectionsBannerProps {
  hd: string;
  /** Published version of the regulations on screen, when known. */
  servedVersion: number | null;
}

const describe = (c: RegsCorrection): string =>
  `${c.published_at.slice(0, 10)} (v${c.version})${c.summary ? ` — ${c.summary}` : ""}`;

export const CorrectionsBanner = ({
  hd,
  servedVersion,
}: CorrectionsBannerProps): JSX.Element | null => {
  const [rows, setRows] = useState<RegsCorrection[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetchCorrections();
        if (alive) setRows(r.data.filter((c) => affectsDistrict(c, hd)));
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [hd]);

  if (rows.length === 0) return null;
  const { missing, included } = splitCorrections(rows, servedVersion);

  return (
    <>
      {missing.length > 0 && (
        <TipBlock heading="Corrections not in this copy" intent="warning">
          <p>
            FWP published {missing.length === 1 ? "a correction" : "corrections"} after the version
            shown here. Reconnect to refresh, or check fwp.mt.gov before you hunt.
          </p>
          <ul className="fwp-bullet-list">
            {missing.map((c) => (
              <li key={c.version}>{describe(c)}</li>
            ))}
          </ul>
        </TipBlock>
      )}
      {included.length > 0 && (
        <TipBlock heading="Corrections included" intent="info">
          <ul className="fwp-bullet-list">
            {included.map((c) => (
              <li key={c.version}>{describe(c)}</li>
            ))}
          </ul>
        </TipBlock>
      )}
    </>
  );
};
