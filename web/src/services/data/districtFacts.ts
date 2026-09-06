/**
 * @file districtFacts.ts
 * @module engage-mt/services/data
 * @description Row shape of the bundled hunting-district-facts dataset
 *              (`/data/hunting-district-facts.json`, registered in
 *              data-manifest.json). Consumers fetch the JSON lazily via
 *              `useFetchJson` and filter in memory — there is no query
 *              engine in this build.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-15
 * @updated 2026-07-15
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export const DISTRICT_FACTS_URL = "/data/hunting-district-facts.json";

export interface DistrictFactsRow {
  district: string;
  region: number;
  name: string;
  acres: number;
  /** Counties the district spans (authoritative, from FWP legal description).
   *  Comma-joined; empty when FWP publishes no legal boundary. */
  counties: string;
  /** Authoritative — `true` when the FWP legal description names a
   *  weapon-restriction area within the district. */
  weapon_restriction: boolean;
}
