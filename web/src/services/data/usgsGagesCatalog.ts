/**
 * @file usgsGagesCatalog.ts
 * @module engage-mt/services/data
 * @description Loader for the bundled USGS gage catalog
 *              (`/data/usgs-gages.json`): active Montana NWIS stream gages built from the NWIS Site Service
 *              sites the map renders as gage markers. Locations only; live
 *              readings are fetched per tap by `services/public/usgsWaterServices`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ttlCache } from "@/services/cache/ttlCache";
import { fetchJson } from "@/utils/http";

export interface UsgsGageRow {
  site_no: string;
  name: string;
  river?: string;
  lat: number;
  lon: number;
}

const CATALOG_URL = "/data/usgs-gages.json";
const CATALOG_TTL_MS = 60 * 60 * 1000; // the catalog is a build artifact

/** Same-origin fetch routed through `fetchJson` so a hung request trips the shared timeout. */
export const fetchUsgsGagesCatalog = (): Promise<UsgsGageRow[]> =>
  ttlCache("usgs-gages-catalog", CATALOG_URL, CATALOG_TTL_MS, () =>
    fetchJson<UsgsGageRow[]>(CATALOG_URL),
  );
