/**
 * @file fish.ts
 * @module engage-mt/config/layers
 * @description Fish-owned layers: fishing access sites, stream gages, river mile markers, waterbody closures.
 *              One entry per map layer; composed into LAYER_REGISTRY by
 *              `web/src/config/layers.ts`, which is the only import path.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { LayerDef } from "@/types/layers";

export const FISH_LAYERS: readonly LayerDef[] = [
  // ───── Fish module ────────────────────────────────────────────────────────
  // combined toggle for Fishing Access Sites. Like WMAs and State
  // Parks, FAS ships both a centroid point sublayer (fishViewer/41) and a
  // boundary polygon sublayer (fishViewer/72). The composite parent below is
  // the user-facing toggle row; it cascades visibility to both children. The
  // children stay separate FeatureLayers and are hidden from the panel so the
  // user sees ONE row that shows the boundary outline + the prominent point
  // badge together, and a tap on either geometry opens the same FAS card.
  {
    id: "engage-mt:fishing-access-sites",
    module: "access",
    title: "Fishing Access Sites",
    description: "Public FWP fishing access sites with parking, boat ramps, and amenities.",
    url: "",
    composite: ["fas-boundaries", "fishing-access-sites"],
    source: "fwp-public-hub",
    sourceLabel: "FWP Fisheries",
    upstreamUrl: "https://fwp-gis.mt.gov/arcgis/rest/services/fish/fishViewer/MapServer",
    freshness: "weekly",
    geometry: "point",
    defaultVisible: false,
    icon: "point",
    backReferenceFor: ["access", "explore"],
  },
  // FAS boundary polygon (fishViewer/72). Defined BEFORE the point child so the
  // point badge draws on top (draw order follows registry order). Subtle
  // boundary outline (no fill) so the centroid point reads as the primary
  // marker; faded at far zoom via minScale so only the badge shows statewide.
  {
    id: "fas-boundaries",
    module: "access",
    title: "Fishing Access Site boundaries",
    description:
      "Parcel boundaries for FWP fishing access sites — paired with the FAS point layer.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/fish/fishViewer/MapServer/72",
    source: "fwp-public-hub",
    sourceLabel: "FWP Fisheries",
    upstreamUrl: "https://fwp-gis.mt.gov/arcgis/rest/services/fish/fishViewer/MapServer",
    freshness: "weekly",
    geometry: "polygon",
    defaultVisible: false,
    minScale: 4_000_000,
    icon: "polygon-vertices",
    hiddenFromPanel: true,
    backReferenceFor: ["access", "explore"],
    symbology: { polygonRole: "boundary" },
    outFieldsHint: [
      "OBJECTID",
      "NAME",
      "WEB_PAGE",
      "PDFMAP",
      "BOAT_FAC",
      "CAMPING",
      "HUNTING",
      "HUNT_ACCESS",
      "ACRES",
      "FWPREG",
    ],
  },
  {
    id: "fishing-access-sites",
    module: "access",
    title: "Fishing Access Sites",
    description: "Public FWP fishing access sites with parking, boat ramps, and amenities.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/fish/fishViewer/MapServer/41",
    source: "fwp-public-hub",
    sourceLabel: "FWP Fisheries",
    upstreamUrl: "https://fwp-gis.mt.gov/arcgis/rest/services/fish/fishViewer/MapServer",
    freshness: "weekly",
    geometry: "point",
    // Off by load (covered by the user's "calmer load" ask).
    // Cluster + disableAtZoom 11 already handle dense FAS legibly when
    // the user does turn this on.
    defaultVisible: false,
    // Hidden from panel — the `engage-mt:fishing-access-sites` composite owns
    // the user-facing toggle row.
    hiddenFromPanel: true,
    icon: "point",
    backReferenceFor: ["access", "explore"],
    symbology: { cluster: { enabled: true, disableAtZoom: 11 } },
    outFieldsHint: [
      "OBJECTID",
      "NAME",
      "WEB_PAGE",
      "BOAT_FAC",
      "CAMPING",
      "HUNTING",
      "PDFMAP",
      "HUNT_ACCESS",
      "ACRES",
      "LATITUDE",
      "LONGITUDE",
      "LMS_ID",
    ],
  },
  // Stream gages. One "Stream gages" row in the layer panel toggles both live
  // networks (USGS NWIS + Montana DNRC StAGE); the composite owns no data of
  // its own — each child layer loads its stations and drives the shared
  // GageCard on tap.
  {
    id: "engage-mt:hydrology",
    panelRank: 4,
    module: "shared",
    title: "Stream gages",
    description:
      "consolidated stream-gage network — USGS streamflow + DNRC StAGE stations, one toggle for the live-conditions stack.",
    url: "",
    composite: ["dnrc-stage-gages", "usgs-gages"],
    source: "external-public",
    sourceLabel: "USGS NWIS + Montana DNRC",
    upstreamUrl: "https://waterservices.usgs.gov/",
    freshness: "realtime",
    geometry: "point",
    defaultVisible: false,
    icon: "water",
  },
  {
    // USGS NWIS stream-gage catalog, built from the NWIS Site Service into
    // `web/public/data/usgs-gages.json`; live discharge / stage / temp
    // pulled per-tap by the GageCard's UsgsBlock via `useUsgsLatest`.
    // Drawn from zoom 8 in. Hidden from the LayerPanel; toggled by the
    // `engage-mt:hydrology` composite above.
    id: "usgs-gages",
    // Per docs/rules/ia.md, USGS gages are Fish-owned.
    // The composite parent stays `shared` so the LayerPanel row keeps
    // the "Conditions" cross-cut grouping; this child layer flips to
    // `fish` so popups badge as FISH with the fish-blue accent stripe.
    module: "fish",
    title: "USGS streamflow gages",
    description:
      "Active USGS NWIS stream gages in Montana that report discharge; live discharge/stage/temp fetched per-tap.",
    url: "",
    source: "external-public",
    sourceLabel: "USGS NWIS",
    upstreamUrl: "https://waterservices.usgs.gov/",
    freshness: "realtime",
    geometry: "point",
    defaultVisible: false,
    icon: "water",
    hiddenFromPanel: true,
  },
  {
    id: "dnrc-stage-gages",
    // Fish-owned per IA; composite parent stays shared.
    module: "fish",
    title: "Stream gages (USGS · DNRC)",
    description:
      "Unified live stream-gage network. DNRC StAGE provides the station list; USGS NWIS data is fetched per-station for discharge + temperature trends.",
    // URL pattern confirmed against the reference implementation — DNRC's public StAGE endpoint is
    // WRD/WMB_StAGE (Water Resources Division / Water Management Bureau).
    // Sublayer 0 = station locations; sublayer 4 = dataset metadata.
    url: "https://gis.dnrc.mt.gov/arcgis/rest/services/WRD/WMB_StAGE/MapServer/0",
    source: "external-public",
    sourceLabel: "Montana DNRC Water Resources",
    upstreamUrl: "https://dnrc.mt.gov/Water-Resources/Surface-Water-Information",
    freshness: "hourly",
    geometry: "point",
    defaultVisible: false,
    icon: "water",
    // Hidden from the panel; the composite "engage-mt:hydrology"
    // row owns this layer's toggle.
    hiddenFromPanel: true,
  },
  // Montana Cadastral Parcels. Endpoint swapped from
  // gis.msl.mt.gov (cert common-name error: ERR_CERT_COMMON_NAME_INVALID)
  // to the MSDI Framework canonical alias and the documented production
  // target.
  //
  // The Montana State Library serves MSDI from the ROK-hosted
  // `gisservice.mt.gov` (its earlier EMCS host `gisservicemt.gov` is retired);
  // the service names differ from the EMCS-era ones: `MSDI_Framework/Parcels/MapServer/0` →
  // `msdi_cadastral_map_v1/MapServer/1` ("Montana Parcels", layer 1 of a
  // 3-layer service: 0=Conservation Easements, 1=Parcels, 2=Public Lands).
  // Verified live: HTTP 200 with a field manifest identical to the old
  // service (PARCELID, COUNTYCD, CountyName, GISAcres, Township/Range/
  // Section, AddressLine1+2, CityStateZip, PropAccess, PropType, OwnerName,
  // OwnerAddress1/2/3, etc.) — CadastralCard needs no field changes.
  // Ref: https://msl.mt.gov/geoinfo/GISWebServiceChanges
  //
  // Un-deferred so the layer participates in tap-to-query like any other
  // public Hub layer. Heavy: minScale-bounded so it only renders when the
  // user has zoomed past the county-overview scale.
  {
    id: "mt-cadastral",
    module: "reference",
    title: "Cadastral land owners",
    description:
      "Statewide parcel ownership — who owns the land under your feet. Zoom in past 1:100k to see individual parcels.",
    url: "https://gisservice.mt.gov/arcgis/rest/services/msdi_cadastral_map_v1/MapServer/1",
    source: "external-public",
    sourceLabel: "Montana State Library (MSDI Parcels)",
    upstreamUrl: "https://geoinfo.msl.mt.gov/",
    // This MSDI MapServer sublayer omits objectIdField from its metadata; pin
    // it so the ArcGIS FeatureLayer builds without inferring the OID field.
    objectIdField: "OBJECTID",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    minScale: 100000,
    icon: "polygon-vertices",
    // Outline-only role so the legend swatch mirrors the map's white parcel
    // grid (no fill). polygonRenderer special-cases the on-map symbol directly.
    symbology: { polygonRole: "boundary" },
    backReferenceFor: ["hunt", "fish", "explore"],
    // Z-order above the Living Atlas VTL so a cadastral click
    // wins the topmost-feature hitTest for owner-level detail.
    zIndex: 35,
    // outFields whitelist matching the actual MSDI public
    // schema (verified via the service's `?f=json` field list). The
    // previous list used `OwnerAddress` / `PropertyAddress` / `PropertyCity`
    // / `OwnerZipcode` — none of which exist on the service; the
    // upstream uses `OwnerAddress1/2/3`, `AddressLine1/2`, `CityStateZip`,
    // and `OwnerZipCode` (Z capital). The invalid-field warnings were
    // firing every render. CadastralCard reads through both the older and
    // canonical names so the popup still resolves.
    outFieldsHint: [
      "OBJECTID",
      "PARCELID",
      "OwnerName",
      "OwnerAddress1",
      "OwnerAddress2",
      "OwnerAddress3",
      "OwnerCity",
      "OwnerState",
      "OwnerZipCode",
      "AddressLine1",
      "AddressLine2",
      "CityStateZip",
      "TotalAcres",
      "PropType",
      "CountyName",
    ],
  },
  // Ported — River-mile point markers at 1-mile cadence
  // along Montana's named streams. Float-trip planner's RM distance math
  // resolves against this layer (MEAS column = miles upstream from mouth,
  // LLID column = NHD reach identifier). Hidden by default; minScale-gated
  // so the markers only render at trip-planning zoom (≤ 144,450 ≈ 1:150k).
  // Source: the refrnc/hydrography/13 swap — anonymously readable, same
  // MEAS+LLID schema as the older refrnc/riverMiles/MapServer/1.
  {
    id: "river-mile-markers",
    module: "reference",
    title: "River mile markers",
    description:
      "FWP river-mile points at 1-mile cadence along Montana's named streams. Tap a marker for its river + mile — the shared reference wardens and search-and-rescue use to pin a location on the water. Also pairs with the Float Trip Planner for put-in / take-out distances.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/refrnc/hydrography/MapServer/13",
    source: "fwp-public-hub",
    sourceLabel: "FWP Hydrography Reference",
    upstreamUrl: "https://fwp-gis.mt.gov/arcgis/rest/services/refrnc/hydrography/MapServer",
    freshness: "static",
    geometry: "point",
    defaultVisible: false,
    minScale: 144450,
    icon: "marker",
    // Defensive whole-mile filter. Sibling sublayers /12 (10-mile) and /14
    // (0.10-mile) exist on the same parent composite; we want only the
    // 1-mile cadence on the map. MEAS is a Single (float); equality vs.
    // FLOOR(MEAS) drops any fractional values if FWP ever rewires the
    // service. Verified 2026-06-09: 93,385 / 93,385 features match.
    definitionExpression: "MEAS = FLOOR(MEAS)",
  },
  {
    // New — live FWP waterbody restrictions & closures (emergency closures,
    // hoot-owl / drought restrictions). A real public source that also feeds the
    // closures notification banner.
    id: "waterbody-closures",
    module: "shared",
    title: "Waterbody Closures & Restrictions",
    description:
      "Current FWP fishing closures and restrictions (emergency closures, hoot-owl, drought).",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/fish/fishViewer/MapServer/1",
    source: "fwp-public-hub",
    sourceLabel: "FWP Fisheries",
    upstreamUrl: "https://fwp.mt.gov/fish/anglingData/restrictions",
    freshness: "daily",
    geometry: "polygon",
    defaultVisible: false,
    icon: "exclamation-mark-triangle",
    symbology: { polygonRole: "overlay" },
    outFieldsHint: [
      "OBJECTID",
      "WATERBODY",
      "TITLE",
      "LOCATION",
      "DESCRIPTION",
      "PRESSRELEASE",
      "RESTRICTIONTYPE",
      "UPDATEDATE",
    ],
  },
];
