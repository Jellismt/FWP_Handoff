/**
 * @file arcgisFeature.ts
 * @module engage-mt/services/public
 * @description Lightweight ArcGIS REST feature lookup. Hits the FeatureLayer's `/query`
 *              endpoint with a parameterized where-clause and returns the first attribute
 *              record. Used by detail pages (BMA, WMA, State Park) to avoid pulling in
 *              the full `@arcgis/core` runtime just for an id lookup.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-04
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { DataError } from "@/utils/errors";
import { fetchJson } from "@/utils/http";

interface QueryOptions {
  /** Feature service URL (no trailing /query). */
  url: string;
  /** WHERE clause. Defaults to OBJECTID = :id. Use `{id}` token for parameter binding. */
  where?: string;
  /** Value substituted into `{id}` (string-safe). */
  id: string;
  /** Out fields. Defaults to "*". */
  outFields?: string[];
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

interface AttrRow {
  attributes: Record<string, unknown>;
}

interface QueryResponse {
  features?: AttrRow[];
  error?: { code?: number; message?: string };
}

/**
 * Safely substitute the `{id}` token. Strips characters that would break the where clause
 * — only allows alphanumerics, dashes, underscores, and periods.
 */
const safeId = (raw: string): string => raw.replace(/[^A-Za-z0-9_\-.]/g, "");

/** Initial bearing (degrees clockwise from N) from point 1 to point 2. */
export const bearingDegrees = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dlambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dlambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

export const fetchFeatureById = async ({
  url,
  where = "OBJECTID = {id}",
  id,
  outFields = ["*"],
  signal,
}: QueryOptions): Promise<Record<string, unknown> | null> => {
  const cleanId = safeId(id);
  if (!cleanId) return null;

  const params = new URLSearchParams({
    f: "json",
    where: where.replaceAll("{id}", cleanId),
    outFields: outFields.join(","),
    returnGeometry: "false",
    resultRecordCount: "1",
  });

  // fetchJson maps non-OK statuses to typed errors (Auth/NotFound/Network) and
  // applies the timeout + caller-signal merge.
  const json = await fetchJson<QueryResponse>(
    `${url}/query?${params.toString()}`,
    signal ? { signal } : {},
  );
  if (json.error) {
    throw new DataError(
      `ArcGIS error ${json.error.code ?? ""}: ${json.error.message ?? "unknown"}`,
    );
  }
  return json.features?.[0]?.attributes ?? null;
};
