/**
 * @file shared.ts
 * @module engage-mt/config/layers
 * @description Cross-cutting Conditions and Reference layers: radar, wind, wildfires, public-land ownership, contours, mountain ranges, hydrography.
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

export const SHARED_LAYERS: readonly LayerDef[] = [
  // ───── Shared cross-cut (Conditions group) ────────────────────────────────
  // Active wildfire INCIDENT POINTS. NIFC's USA_Wildfires_v1
  // service ships the IRWIN incident location for every current wildland
  // fire. We render it as a standalone red flame icon (no circle backing)
  // so users see "where fires are right now" at a glance the moment the
  // map opens. Tap routes through the ActiveFireCard.
  {
    id: "active-fires-points",
    panelRank: 2,
    module: "shared",
    title: "Wildfires",
    description: "Live wildfire incident locations from NIFC IRWIN.",
    // NIFC's USA_Wildfires_v1 service layout (probed
    // 2026-06-03):
    //   /0  Current_Incidents (points)   — rich IRWIN schema
    //   /1  Current_Perimeters (polygons)
    // The original wiring pointed at /1 by mistake; corrected
    // to /0 so the standalone red flame icon resolves to real incident
    // points with DailyAcres, PercentContained, FireDiscoveryDateTime,
    // etc.
    url: "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/USA_Wildfires_v1/FeatureServer/0",
    source: "external-public",
    sourceLabel: "NIFC / Esri Living Atlas",
    upstreamUrl: "https://www.nifc.gov/fire-information/maps",
    freshness: "hourly",
    geometry: "point",
    defaultVisible: true,
    icon: "fire",
    // Whitelist only fields the NIFC /1 (incident points)
    // service actually ships. Perimeter-only fields (ContainmentDateTime,
    // FinalAcres, FireOutDateTime, ModifiedOnDateTime, FireCause,
    // FireCauseGeneral) are NOT in /1's schema (verified 2026-06-03);
    // requesting them logs invalid-field warnings. The ActiveFireCard
    // renderer reads via a tolerant pick() helper so missing fields
    // simply suppress the corresponding pill.
    outFieldsHint: [
      "OBJECTID",
      "IncidentName",
      "IncidentTypeCategory",
      "UniqueFireIdentifier",
      "DailyAcres",
      "PercentContained",
      "FireDiscoveryDateTime",
      "DiscoveryAcres",
      "POOCounty",
      "POOState",
      // `POOResponsibleAgency` was in the whitelist but the
      // NIFC service's actual schema (verified via ?f=json on
      // FeatureServer/0) only ships `POOCounty` / `POOState`. The
      // ActiveFireCard renderer's `agency` lookup falls back to
      // `POOLandownerKind` / `Owner` when this is absent.
      "IrwinID",
    ],
    // NIFC's USA_Wildfires_v1 schema migrated POOState from
    // raw 2-letter codes ("MT") to ISO 3166-2 codes ("US-MT") (verified
    // via ?f=json 2026-06-05). Also scope to ACTIVE wildfires only:
    // incident category WF (not prescribed burns) with no fire-out date
    // yet (still burning). Applied at the FeatureLayer + tap-query.
    definitionExpression:
      "POOState='US-MT' AND IncidentTypeCategory='WF' AND FireOutDateTime IS NULL",
  },
  // Esri Living Atlas wind & temperature stations.
  // Loads via portal item rather than a hardcoded URL so we ride the
  // Living Atlas's own service-rotation. Symbology renders class-broken
  // arrow markers per Beaufort tier with rotation driven by the
  // WIND_DIRECT field (a "from→to" convention, so the marker applies +180°).
  // Default-visible so users see live conditions at first
  // load (matches common weather-overlay UX).
  {
    id: "engage-mt:wind-stations",
    panelRank: 3,
    // Lives in the Conditions group (radar → wind → gages → fires).
    module: "shared",
    title: "Wind arrows",
    description:
      "Live wind speed + direction + temperature + humidity from Esri's Living Atlas Wind & Temperature service. Arrows rotate to wind heading; Beaufort-tier color ramp.",
    url: "",
    portalItemId: "cb1886ff0a9d4156ba4d2fadd7e8a139",
    source: "esri-living-atlas",
    sourceLabel: "Esri Living Atlas — Wind & Temperature",
    upstreamUrl: "https://www.arcgis.com/home/item.html?id=cb1886ff0a9d4156ba4d2fadd7e8a139",
    freshness: "hourly",
    geometry: "point",
    defaultVisible: true,
    icon: "compass",
    opacity: 0.85,
    // Only request the fields the wind renderer + popup need.
    // The Living Atlas Wind service ships dozens of station fields; the
    // FeatureLayer was overfetching with the default ["*"]. These six
    // fields drive the speed-bucket color, arrow rotation, and the
    // WindStationCard popup.
    outFieldsHint: [
      "OBJECTID",
      "STATION_NAME",
      "WIND_SPEED",
      "WIND_GUST",
      "WIND_DIRECT",
      "TEMP",
      "DEWPOINT",
      "RELATIVE_HUMIDITY",
    ],
    // Montana scoping (arcgis.md § Montana scoping): the Esri Living Atlas
    // Wind & Temperature service aggregates global ASOS/AWOS/WMO
    // meteorological stations and does not carry a US state-coded
    // attribute field — confirmed 2026-06-14 via portal item metadata.
    // A definitionExpression therefore can't scope it, and minScale alone
    // never did: it only gates the zoom at which the layer draws, while
    // the map's view constraint is a rectangular ~75-mi buffer (not a
    // clip), so arrows rendered across ID/WY/Dakotas/Canada. The honest
    // fix is a geometry clip — `montanaClip: 'feature'` applies a
    // featureEffect against the Montana polygon in attachRegistryLayers,
    // so out-of-state arrows leave both the render AND tap-query.
    montanaClip: "feature",
    minScale: 5_000_000,
  },
  // NOAA NEXRAD composite reflectivity. ImageryLayer
  // (raster) at 0.7 opacity so the basemap + other layers stay legible.
  // popupEnabled is implicitly false because raster has no point
  // features to query — the user reads the radar visually.

  {
    // Mountain-range reference labels. MSDI Geographic Names is a
    // GNIS point service; `Class='Range'` selects the 74 named Montana ranges
    // (label points at each range centroid — a handy orienting reference, not a
    // range boundary polygon, which GNIS doesn't publish). Off by default.
    // Montana-scoped: the MSDI service is statewide-only at the service level.
    id: "mountain-ranges",
    module: "reference",
    title: "Mountain ranges",
    // The MSDI geographic-names MapServer sublayer omits objectIdField from
    // its metadata, which makes the ArcGIS FeatureLayer fail to load; pin it.
    objectIdField: "OBJECTID",
    description:
      "Named mountain ranges across Montana (label points from the USGS/MSDI geographic-names database) — a quick orienting reference.",
    url: "https://gisservice.mt.gov/arcgis/rest/services/msdi_geographic_names_map_v1/MapServer/0",
    definitionExpression: "Class='Range'",
    source: "external-public",
    sourceLabel: "MSDI Geographic Names (GNIS)",
    upstreamUrl: "https://gisservice.mt.gov/",
    freshness: "static",
    geometry: "point",
    defaultVisible: false,
    icon: "mountain",
    outFieldsHint: ["Name", "Class", "County", "Elevation"],
    // Loud at state zoom (74 labels); fade in only at region scale + tighter.
    minScale: 3000000,
  },
  {
    id: "noaa-radar-reflectivity",
    panelRank: 1,
    // Lives in the Conditions group (radar → wind → gages → fires).
    module: "shared",
    title: "Radar",
    description:
      "Live NEXRAD composite base reflectivity. Greens / yellows = light to moderate rain; reds / purples = heavy or severe.",
    url: "https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity_time/ImageServer",
    source: "external-public",
    sourceLabel: "NOAA NEXRAD",
    upstreamUrl: "https://www.weather.gov/",
    freshness: "realtime",
    geometry: "raster",
    // Off by default per the user's "satellite + wind + VTL"
    // calm-load brief. Reflectivity is still one tap away in the layer
    // panel and remains real-time when toggled.
    defaultVisible: true,
    icon: "cloud",
    opacity: 0.7,
    // Nationwide NEXRAD imagery — a raster ImageServer with no state
    // attribute and no client-side polygon clip. Scoped by the translucent
    // focus mask (dimmed outside Montana) + default-off. A hard raster clip
    // (GroupLayer + destination-in) is a tracked follow-up.
    montanaScopeNote:
      "NEXRAD raster ImageServer: no state field and no client polygon clip; dimmed outside MT by the focus mask, default-off.",
  },
  // Reference — check-station networks. the AIS + CWD
  // check-station POINT layers are cross-cutting compliance/safety
  // infrastructure relevant to anglers *and* hunters, so they live in the
  // Reference top group (loaded regardless of active tab) rather than under
  // Fish / Hunt. Both are off by default (defaultVisible: false) — the user
  // toggles them on. Marker icons resolve from ICON_REGISTRY; the user supplies
  // final PNGs (AIS already has one; CWD ships a glyph placeholder).
  {
    id: "ais-inspection-stations",
    panelRank: 3,
    // Relocated from Fish into the Reference top group.
    module: "reference",
    zIndex: 8,
    title: "AIS Inspection Stations",
    description:
      "Mandatory aquatic-invasive-species watercraft inspection stations across Montana.",
    // fishViewer/MapServer/18 = FWP Watercraft Inspection Stations
    // (61 is Wild and Scenic Stream Designations — wrong layer).
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/fish/fishViewer/MapServer/18",
    source: "fwp-public-hub",
    sourceLabel: "FWP AIS Program",
    upstreamUrl: "https://fwp.mt.gov/aboutfwp/ais/inspection-stations",
    freshness: "weekly",
    geometry: "point",
    defaultVisible: false,
    icon: "alert",
    // ~30 inspection stations statewide; drop threshold so they
    // read individually at zoom 9+ instead of clustering until zoom 11.
    symbology: { cluster: { enabled: true, disableAtZoom: 9 } },
    outFieldsHint: [
      "OBJECTID",
      "STATIONNM",
      "STATIONTYP",
      "AGENCY",
      "ADDRESS",
      "DIRECTION",
      "HOURSDAYS",
      "DATEOPEN",
      "DATECLOSE",
    ],
  },
  {
    id: "cwd-check-stations",
    panelRank: 4,
    module: "reference",
    zIndex: 8,
    title: "CWD Check Stations",
    description:
      "Seasonal FWP stations where hunters submit deer & elk samples for chronic wasting disease testing.",
    // Item #8 — swapped from the bundled fixture to FWP's live hosted PublicView
    // service, which carries the real station DATES + DAY_TIME (hours). The
    // bundled /data/cwd-check-stations.geojson remains as the offline fallback
    // (cwdZones.ts + its guard test are unaffected — they still describe the
    // priority zones).
    url: "https://services3.arcgis.com/Cdxz8r11hT0MGzg1/arcgis/rest/services/Hunter_Harvest_Check_Stations_for_CWD_Surveillance__PublicView/FeatureServer/0",
    source: "fwp-public-hub",
    sourceLabel: "FWP Wildlife Health",
    upstreamUrl: "https://fwp.mt.gov/cwd",
    freshness: "weekly",
    geometry: "point",
    defaultVisible: false,
    icon: "exclamation-mark-triangle",
    // Sparse statewide network — read individually, no clustering. sizeBoost
    // gives the marker prominence at the reference tier.
    symbology: { sizeBoost: 1.2 },
    outFieldsHint: [
      "OBJECTID",
      "NAME",
      "REGION",
      "DATES",
      "DAY_TIME",
      "TYPE",
      "LOCATION",
      "COMMENTS",
      "LAT",
      "LONG_",
    ],
  },
  {
    // Items #6 / #7 — FWP game-warden coverage areas. Public hosted service with
    // real name + badge + phone + email. Tap resolves the covering warden; the
    id: "warden-districts",
    module: "hunt",
    zIndex: 7,
    title: "Game Warden Districts",
    description:
      "FWP game-warden coverage areas — tap to see the warden (name, badge, phone) for that area.",
    url: "https://services3.arcgis.com/Cdxz8r11hT0MGzg1/arcgis/rest/services/ADMBND_RESPAREA_WARDEN/FeatureServer/0",
    source: "fwp-public-hub",
    sourceLabel: "FWP Enforcement",
    upstreamUrl: "https://fwp.mt.gov/aboutfwp/enforcement",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "shield",
    symbology: { polygonRole: "boundary" },
    outFieldsHint: [
      "OBJECTID",
      "REGION",
      "AREANAME",
      "DISPLAYNAME",
      "CONTACT",
      "BADGENUM",
      "PHONE",
      "EMAIL_ADDR",
      "TITLE",
    ],
  },

  // Simplified "major rivers & lakes" from the Montana State Library MSDI
  // Hydrography service — named (major) features only, so the map stays clean.
  // Composite: a river-line child + a lake-polygon child under one blue toggle.
  {
    id: "engage-mt:major-hydro",
    module: "reference",
    title: "Major rivers & lakes",
    description: "Montana's major named rivers and lakes — one feature per river or waterbody.",
    url: "",
    composite: ["major-rivers", "major-lakes"],
    source: "external-public",
    sourceLabel: "Montana State Library (1:100k Major Lakes & Streams)",
    upstreamUrl: "https://www.sciencebase.gov/catalog/item/4fff207de4b08406cdf65620",
    freshness: "static",
    geometry: "line",
    defaultVisible: false,
    icon: "water",
  },
  {
    id: "major-rivers",
    module: "reference",
    title: "Major rivers",
    description: "Montana's major named rivers and streams — one line per river.",
    // Swapped off the MSDI NHD flowline service, which is the full
    // 269k-feature stream network: every river arrived shattered into hundreds of
    // reach segments (the Ruby River was 199 features, the Missouri 1,775), so a
    // tap hit a 50 m fragment and labels repeated down the channel. This is the
    // Montana State Library's 1:100k "Major Lakes and Streams" cartographic
    // selection (5,499 arcs), dissolved by name at build time into 989 named
    // rivers — one feature per river — then simplified to ~33 m. Dissolving is
    // only possible on data we bundle; a service we don't own can't do it.
    // See scripts/build-data/README.md for the regeneration recipe.
    url: "/data/major-rivers.geojson",
    source: "external-public",
    sourceLabel: "Montana State Library (1:100k Major Lakes & Streams)",
    upstreamUrl: "https://www.sciencebase.gov/catalog/item/4fff207de4b08406cdf65620",
    freshness: "static",
    geometry: "line",
    defaultVisible: false,
    hiddenFromPanel: true,
    icon: "line",
    outFieldsHint: ["name", "class", "miles"],
    minScale: 1500000,
    montanaScopeNote: "Montana-only dataset (Montana State Library).",
  },
  {
    id: "major-lakes",
    module: "reference",
    title: "Major lakes",
    description: "Montana's major named lakes and reservoirs — one shape per waterbody.",
    // Companion to `major-rivers` — same Montana State Library 1:100k source,
    // same build-time dissolve-by-name (427 polygons → 299 named waterbodies,
    // so Flathead Lake is one shape rather than a pile of parts).
    url: "/data/major-lakes.geojson",
    source: "external-public",
    sourceLabel: "Montana State Library (1:100k Major Lakes & Streams)",
    upstreamUrl: "https://www.sciencebase.gov/catalog/item/4fff207de4b08406cdf65620",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    hiddenFromPanel: true,
    icon: "water",
    outFieldsHint: ["name", "class", "acres"],
    minScale: 1500000,
    montanaScopeNote: "Montana-only dataset (Montana State Library).",
  },
  {
    // Item #4 — FWP license-ambassador locations (where to buy a license). Real
    // public hosted point service with business name, address, phone, website,
    // and lat/lon.
    // Cross-cutting service locations (anglers + hunters) → reference module;
    // Manage is deliberately not a spatial surface per docs/rules/ia.md.
    id: "license-ambassadors",
    panelRank: 2,
    module: "reference",
    title: "License Ambassadors",
    description: "Local businesses where you can buy a Montana hunting/fishing license in person.",
    url: "https://services3.arcgis.com/Cdxz8r11hT0MGzg1/arcgis/rest/services/ADMBND_FWP_LICENSE_AMBASSADORS/FeatureServer/0",
    source: "fwp-public-hub",
    sourceLabel: "FWP Licensing",
    upstreamUrl: "https://fwp.mt.gov/buyandapply/license-ambassadors",
    freshness: "weekly",
    geometry: "point",
    defaultVisible: false,
    icon: "credit-card",
    symbology: { cluster: { enabled: true, disableAtZoom: 9 } },
    outFieldsHint: [
      "OBJECTID",
      "BUSINESS_NAME",
      "BUSINESS_ADDRESS",
      "BUSINESS_CITY",
      "BUSINESS_STATE",
      "BUSINESS_ZIPCODE",
      "CONTACT_PHONE",
      "BUSINESS_URL",
      "CONTACT_EMAIL",
      "X",
      "Y",
    ],
  },
];
