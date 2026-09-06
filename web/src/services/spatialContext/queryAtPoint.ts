/**
 * @file queryAtPoint.ts
 * @module engage-mt/services/spatialContext
 * @description Shared point-in-polygon fetch helper for callers
 *              that need a single named attribute from a public ArcGIS
 *              MapServer/FeatureServer layer at a tapped point.
 *
 *              All queries:
 *                - hit public services (no auth)
 *                - send lat/lon in WGS84 (wkid 4326)
 *                - request a tiny outFields whitelist
 *                - return geometry: false
 *                - resolve to the first feature's attributes, or null
 *
 *              Privacy: the tap point goes to FWP's public REST endpoints
 *              and the NHD/MSDI public services — the same endpoints the
 *              ArcGIS map view already uses. No coordinate leaves the
 *              device to any third-party analytics / behavioral service.
 *              Per `docs/rules/privacy.md`.
 *
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-07-01
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { fetchArcgisQuery, fetchJson } from "@/utils/http";

interface QueryAtPointInput {
  /** ArcGIS REST layer URL (MapServer/N or FeatureServer/N). */
  url: string;
  longitude: number;
  latitude: number;
  /** Attribute fields to surface. Pass the minimum needed. */
  outFields: readonly string[];
  /** Optional per-request timeout. Default 6000 ms. */
  timeoutMs?: number;
  /**
   * Optional SQL predicate ANDed with the spatial intersect.
   * Use to scope national MapServer endpoints to Montana — e.g. the HUC
   * lookup passes `huc8 LIKE '10%' OR huc8 LIKE '17%' OR huc8 LIKE '09%'`
   * so a point that falls outside Montana resolves to null instead of an
   * out-of-state HUC. Defaults to `1=1` (no filter).
   */
  where?: string;
}

/**
 * Run a point-in-polygon query against an ArcGIS layer and return the
 * first feature's attributes, or null if no hit / timeout / error.
 *
 * Returns null on every failure path — callers should treat null as
 * "no data available here" and gracefully drop the corresponding UI
 * row (per `docs/rules/feature-cards.md` partial-data tolerance).
 */
const isTimeout = (err: unknown): boolean => {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.name : "";
  return name === "AbortError" || cause === "AbortError" || /timed? ?out|abort/i.test(message);
};

export type PointQueryResult =
  | { kind: "hit"; attrs: Record<string, unknown> }
  | { kind: "no-hit" }
  | { kind: "failed"; reason: "timeout" | "network" | "service" };

/**
 * Like `queryAttributesAtPoint` but distinguishes "the service answered and
 * nothing is here" from "the service could not be reached".
 */
export async function queryPointResult(input: QueryAtPointInput): Promise<PointQueryResult> {
  const { url, longitude, latitude, outFields, timeoutMs = 6000, where = "1=1" } = input;
  const params = new URLSearchParams({
    f: "json",
    geometry: JSON.stringify({ x: longitude, y: latitude, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    returnGeometry: "false",
    outFields: outFields.join(","),
    where,
  });
  try {
    const json = await fetchJson<{
      features?: Array<{ attributes?: Record<string, unknown> }>;
      error?: unknown;
    }>(`${url}/query?${params.toString()}`, { timeoutMs });
    if (json && typeof json === "object" && json.error)
      return { kind: "failed", reason: "service" };
    const attrs = json?.features?.[0]?.attributes;
    return attrs ? { kind: "hit", attrs } : { kind: "no-hit" };
  } catch (err) {
    return { kind: "failed", reason: isTimeout(err) ? "timeout" : "network" };
  }
}

export async function queryAttributesAtPoint(
  input: QueryAtPointInput,
): Promise<Record<string, unknown> | null> {
  const { url, longitude, latitude, outFields, timeoutMs = 6000, where = "1=1" } = input;

  const params = new URLSearchParams({
    f: "json",
    geometry: JSON.stringify({
      x: longitude,
      y: latitude,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    returnGeometry: "false",
    outFields: outFields.join(","),
    where,
  });

  const fullUrl = `${url}/query?${params.toString()}`;

  const json = await fetchArcgisQuery<{
    features?: Array<{ attributes?: Record<string, unknown> }>;
  }>(fullUrl, { timeoutMs });
  return json?.features?.[0]?.attributes ?? null;
}
