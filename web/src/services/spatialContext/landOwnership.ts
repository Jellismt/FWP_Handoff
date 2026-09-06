/**
 * @file landOwnership.ts
 * @module engage-mt/services/spatialContext
 * @description Bare-land ownership resolver. Given a tap point, queries the
 *              MSDI cadastral parcel layer and returns its attributes — so an
 *              empty tap on bare land can still answer "whose land is this?"
 *              The cadastral OwnerName encodes BLM / USFS / state / private
 *              (classified downstream by `resolveAgency` inside CadastralCard).
 *
 *              Privacy: the query hits the same public MSDI REST endpoint the
 *              map view already uses; the tap point never leaves the device
 *              for any analytics / behavioral service. Per
 *              `docs/rules/privacy.md`.
 *
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-10
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { LAYER_REGISTRY, getLayerUrl } from "@/config/layers";
import { queryPointResult } from "./queryAtPoint";

const CADASTRAL_LAYER_ID = "mt-cadastral";

/**
 * Result of a bare-land ownership lookup.
 *
 * - `cadastral` — the point falls on a cadastral parcel; `attrs` route to
 *   CadastralCard, which classifies BLM / USFS / state / private / tribal.
 * - `null`      — no parcel coverage at the point (out of state, open water,
 *   or a service gap); the caller keeps its empty-tap fallback.
 */
export type OwnershipResolution =
  | { kind: "cadastral"; attrs: Record<string, unknown> }
  /** The cadastral service answered: no parcel record at this point. */
  | { kind: "none" }
  /** The cadastral service could not be reached. */
  | { kind: "unavailable"; reason: "timeout" | "network" | "service" };

/**
 * outFields for a registry layer — sourced from its `outFieldsHint` so the
 * field list never drifts from the registry. Falls back to `["*"]` if the
 * hint is ever removed. Used for both the cadastral + state-trust point
 * queries so neither over-fetches the wide service schema.
 */
const outFieldsFor = (layerId: string): readonly string[] => {
  const def = LAYER_REGISTRY.find((d) => d.id === layerId);
  return def?.outFieldsHint && def.outFieldsHint.length > 0 ? def.outFieldsHint : ["*"];
};

/**
 * Resolve land ownership at a WGS84 point by querying the cadastral service.
 * Returns the parcel hit, or null when the service reports no feature.
 *
 * Never throws — `queryAttributesAtPoint` resolves to null on every failure
 * path (timeout, network, service error), so callers can treat a null return
 * as "no ownership data available here."
 */
export async function resolveLandOwnershipAtPoint(
  longitude: number,
  latitude: number,
): Promise<OwnershipResolution> {
  const result = await queryPointResult({
    url: getLayerUrl(CADASTRAL_LAYER_ID),
    longitude,
    latitude,
    outFields: outFieldsFor(CADASTRAL_LAYER_ID),
  });
  if (result.kind === "hit") return { kind: "cadastral", attrs: result.attrs };
  if (result.kind === "failed") return { kind: "unavailable", reason: result.reason };
  return { kind: "none" };
}
