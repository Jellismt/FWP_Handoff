/**
 * @file useDistrictEnrichment.ts
 * @module engage-mt/hooks
 * @description District-scoped enrichment for the regulations panel: the restricted areas
 *              and youth/PTHFV opportunities that apply in a given hunting district, from
 *              the regs v2 API. Both fetch the whole (small) list once and filter locally.
 *              Fail-soft by contract — enrichment must never degrade the core regs panel,
 *              so an error resolves to an empty list (the section then hides).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import {
  fetchRestrictedAreas,
  restrictedAreasForDistrict,
} from "@/services/regsApi/restrictedAreas";
import {
  fetchYouthOpportunities,
  youthOpportunitiesForDistrict,
} from "@/services/regsApi/youthOpportunities";
import type { RestrictedArea, YouthOpportunity } from "@/services/regsApi/types";

/** Restricted areas linked to a district. `[]` while loading or on any error. */
export function useRestrictedAreas(hd: string | null | undefined): RestrictedArea[] {
  const [areas, setAreas] = useState<RestrictedArea[]>([]);
  useEffect(() => {
    if (!hd) {
      setAreas([]);
      return;
    }
    let alive = true;
    fetchRestrictedAreas()
      .then((r) => {
        if (alive) setAreas(restrictedAreasForDistrict(r.data, hd));
      })
      .catch(() => {
        if (alive) setAreas([]);
      });
    return () => {
      alive = false;
    };
  }, [hd]);
  return areas;
}

/** Youth/PTHFV opportunities valid in a district. `[]` while loading or on any error. */
export function useYouthOpportunities(hd: string | null | undefined): YouthOpportunity[] {
  const [rows, setRows] = useState<YouthOpportunity[]>([]);
  useEffect(() => {
    if (!hd) {
      setRows([]);
      return;
    }
    let alive = true;
    fetchYouthOpportunities()
      .then((r) => {
        if (alive) setRows(youthOpportunitiesForDistrict(r.data, hd));
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [hd]);
  return rows;
}
