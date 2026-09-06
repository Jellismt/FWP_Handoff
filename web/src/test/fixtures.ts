/**
 * @file fixtures.ts
 * @module engage-mt/test
 * @description Shared attribute fixtures for FeatureCard
 *              renderer tests. Each fixture mirrors a representative
 *              feature returned by the underlying ArcGIS service so that
 *              renderer tests exercise the field-mapping paths.
 *
 *              Pattern: every fixture is keyed by the layer id from
 *              `web/src/config/layers.ts` and returns a partial attrs
 *              object the renderer would receive after a tap-query hit.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";

type Attrs = Record<string, unknown>;

export const FIXTURE_ATTRS: Record<string, Attrs> = {
  "bma-boundaries": {
    // Schema mirrors FWPLND_BMA_BOUNDARY/0 (verified 2026-06-07): BMANAME +
    // BMANUM, not BMA_NAME / BMA_NUMBER. ACRES + USE_TYPE are synthetic
    // helper attrs the renderer accepts as enrichments.
    BMANUM: 7,
    BMANAME: "Roundtop BMA",
    ACRES: 6420,
    REGION: 3,
    USE_TYPE: "Big game",
  },
  "fishing-access-sites": {
    NAME: "Lone Pine FAS",
    REGION: 3,
    COUNTY: "Madison",
    ACRES: 12,
    BOAT_RAMP: "Concrete",
    CAMPING: "Yes",
    RESTROOM: "Vault",
    ADA: "Yes",
    WATERBODY: "Madison River",
    WEB_PAGE: "https://fwp.mt.gov/fas/lone-pine",
    PDFMAP: "https://fwp.mt.gov/maps/lone-pine.pdf",
    LATITUDE: 45.291,
    LONGITUDE: -111.948,
    HUNT_ACCESS: "Refer to current Montana hunting regulations.",
    FWB_ID: "1234",
  },
  "state-parks": {
    NAME: "Bannack State Park",
    PARK_NAME: "Bannack State Park",
    ACRES: 1230,
    REGION: 3,
    COUNTY: "Beaverhead",
    PHONE: "(406) 834-3413",
    ADDRESS: "4200 Bannack Rd",
    CITY: "Dillon",
    DESCRIPTION: "Montana's first territorial capital.",
    SEASON: "Year-round",
    FEE: "8 USD",
    CAMPING: "Yes",
    FISHING: "Yes",
    ADA: "Yes",
    OBJECTID: 17,
    WEB_PAGE: "https://stateparks.mt.gov/bannack",
    PDFMAP: "https://stateparks.mt.gov/maps/bannack.pdf",
    LATITUDE: 45.165,
    LONGITUDE: -112.998,
  },
  "wildlife-management-areas": {
    NAME: "Mt. Haggin WMA",
    WMA_NAME: "Mt. Haggin WMA",
    ACRES: 56000,
    REGION: 3,
    COUNTY: "Deer Lodge",
    PURPOSE: "Big-game winter range + elk calving habitat.",
    HUNTING: "Yes",
    OBJECTID: 9,
    WEB_PAGE: "https://fwp.mt.gov/wma/mt-haggin",
    LATITUDE: 46.05,
    LONGITUDE: -112.95,
  },
  "hunting-districts": {
    DISTRICT: "380",
    REGION: 4,
    ACRES: 410000,
  },
  "mt-cadastral": {
    PARCELID: "30-3047-23-1-04",
    COUNTYCD: "Madison",
    CountyName: "Madison",
    GISAcres: 42.7,
    PropType: "Agricultural",
    PropAccess: "Public Road",
    AddressLine1: "1023 Madison Lane",
    CityStateZip: "Ennis MT 59729",
    Township: "06S",
    Range: "01E",
    Section: "27",
    Subdivision: "Madison Ranch",
    LegalDescriptionShort: "S27 T06S R01E NW1/4",
  },
  "dnrc-stage-gages": {
    // Schema mirrors the DNRC StAGE MapServer/0 station layer.
    LocationCode: "06038500",
    LocationName: "Madison River at Three Forks",
  },
  // Fixtures for the Tier-2 cards + 5 per-species HDs.
  "blm-recreation-sites": {
    NAME: "Holter Lake Recreation Area",
    USE_TYPE: "Boat ramp + day-use",
    ACRES: 102,
    CAMPING: "Yes",
    FISHING: "Yes",
    HIKING: "Yes",
    DESCRIPTION: "BLM-managed; trout + walleye fishery.",
  },
  "usfs-recreation-sites": {
    NAME: "Hyalite Reservoir",
    FOREST_NAME: "Custer Gallatin NF",
    DISTRICT: "Bozeman",
    USE_TYPE: "Day-use + camping",
    CAMPING: "Yes",
    FISHING: "Yes",
    HIKING: "Yes",
  },
  "bor-recreation-sites": {
    NAME: "Canyon Ferry — Silos",
    WATERBODY: "Canyon Ferry",
    USE_TYPE: "Boat ramp + day-use",
    FEE: "$5",
    BOAT_RAMP: "Yes",
    PICNIC: "Yes",
  },
  "hunting-districts-antelope": {
    DISTRICT: "400",
    REGION: 7,
    ACRES: 1_500_000,
  },
  "hunting-districts-sheep": {
    DISTRICT: "501",
    REGION: 5,
    ACRES: 250_000,
  },
  "hunting-districts-moose": {
    DISTRICT: "316",
    REGION: 3,
    ACRES: 410_000,
  },
  "hunting-districts-goat": {
    DISTRICT: "215",
    REGION: 2,
    ACRES: 175_000,
  },
  "hunting-districts-upland-bird": {
    DISTRICT: "650",
    REGION: 6,
    ACRES: 2_100_000,
  },
};

/** Build a FeatureRendererProps object suitable for a renderer test. */
export const fixtureProps = (
  layerId: string,
  overrides?: Partial<FeatureRendererProps>,
): FeatureRendererProps => ({
  attrs: FIXTURE_ATTRS[layerId] ?? {},
  layerId,
  layerTitle: layerId,
  module: "fish",
  ...overrides,
});
