/**
 * @file explore.ts
 * @module engage-mt/config/layers
 * @description Explore module layers: state parks, wildlife management areas, trails.
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

export const EXPLORE_LAYERS: readonly LayerDef[] = [
  // ───── Explore module ─────────────────────────────────────────────────────
  // combined toggles for WMAs and State Parks. Each ships a boundary
  // polygon sublayer + a centroid point sublayer on the same FWP Lands
  // MapServer. The composite parents below are the user-facing toggle rows;
  // each cascades visibility to its polygon + point children (hidden from the
  // panel) so the user sees ONE row that shows the boundary outline + the
  // prominent point badge together, and a tap on either geometry opens the
  // same card.
  {
    id: "engage-mt:state-parks",
    module: "access",
    title: "State Parks",
    description: "Montana State Parks managed by FWP.",
    url: "",
    composite: ["state-parks", "state-parks-points"],
    source: "fwp-public-hub",
    sourceLabel: "FWP Parks",
    upstreamUrl: "https://fwp.mt.gov/stateparks",
    freshness: "static",
    geometry: "point",
    defaultVisible: false,
    icon: "tree",
    backReferenceFor: ["access"],
  },
  {
    id: "engage-mt:wmas",
    module: "access",
    title: "Wildlife Management Areas",
    description: "FWP-owned wildlife management areas open to public recreation.",
    url: "",
    composite: ["wildlife-management-areas", "wma-points"],
    source: "fwp-public-hub",
    sourceLabel: "FWP Lands",
    upstreamUrl: "https://fwp-gis.mt.gov/arcgis/rest/services/fwplnd/fwpLands/MapServer",
    freshness: "static",
    geometry: "point",
    defaultVisible: false,
    icon: "polygon-vertices",
    backReferenceFor: ["hunt", "access"],
  },
  {
    id: "wildlife-management-areas",
    module: "access",
    title: "Wildlife Management Areas",
    description: "FWP-owned wildlife management areas open to public recreation.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/fwplnd/fwpLands/MapServer/8",
    source: "fwp-public-hub",
    sourceLabel: "FWP Lands",
    upstreamUrl: "https://fwp-gis.mt.gov/arcgis/rest/services/fwplnd/fwpLands/MapServer",
    freshness: "static",
    geometry: "polygon",
    // Off by load; visible from region scale once toggled.
    defaultVisible: false,
    // Hidden from panel — the `engage-mt:wmas` composite owns the toggle row.
    hiddenFromPanel: true,
    minScale: 4_000_000,
    icon: "polygon-vertices",
    backReferenceFor: ["hunt", "access"],
    // Subtle boundary outline (no fill) so the paired centroid point badge
    // reads as the primary marker.
    symbology: { polygonRole: "boundary" },
    outFieldsHint: [
      "OBJECTID",
      "NAME",
      "WEB_PAGE",
      "PDFMAP",
      "HUNTING",
      "CAMPING",
      "BOAT_FAC",
      "FWPREG",
      "ACRES",
      "HUNT_ACCESS",
    ],
  },
  {
    id: "state-parks",
    module: "access",
    title: "State Parks",
    description: "Montana State Parks managed by FWP.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/fwplnd/fwpLands/MapServer/5",
    source: "fwp-public-hub",
    sourceLabel: "FWP Parks",
    upstreamUrl: "https://fwp.mt.gov/stateparks",
    freshness: "static",
    geometry: "polygon",
    // Off by load; state parks reveal at sub-state zoom.
    defaultVisible: false,
    // Hidden from panel — the `engage-mt:state-parks` composite owns the row.
    hiddenFromPanel: true,
    minScale: 4_000_000,
    icon: "tree",
    // Subtle boundary outline (no fill) so the paired centroid point badge
    // reads as the primary marker.
    symbology: { polygonRole: "boundary" },
    outFieldsHint: [
      "OBJECTID",
      "NAME",
      "WEB_PAGE",
      "PDFMAP",
      "CAMPING",
      "BOAT_FAC",
      "HUNTING",
      "ACRES",
      "FWPREG",
      "HUNT_ACCESS",
    ],
  },
  // Point companion for `state-parks`. Same upstream service,
  // sibling sublayer /4 (State Park Locations). Carries the custom
  // state-parks.png centroid badge so the polygon outline + a labeled
  // POI marker read together.
  {
    id: "state-parks-points",
    module: "access",
    title: "State Parks (POIs)",
    description:
      "Centroid markers for Montana State Parks — paired with the State Parks polygon layer.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/fwplnd/fwpLands/MapServer/4",
    source: "fwp-public-hub",
    sourceLabel: "FWP Parks",
    upstreamUrl: "https://fwp.mt.gov/stateparks",
    freshness: "static",
    geometry: "point",
    icon: "point",
    defaultVisible: false,
    // Hidden from panel — the `engage-mt:state-parks` composite owns the row.
    hiddenFromPanel: true,
    backReferenceFor: ["access"],
    // The point centroid is the PRIMARY visible marker (the polygon is a
    // boundary-only outline), so its tap-query must carry the same activity
    // attributes the StateParkCard renders — otherwise the Camp/Boat/Hunt
    // badges + the LAT/LON-derived Directions link render blank on a point
    // tap. Field list verified against fwpLands/MapServer/4?f=json;
    // sublayer /4 ships no FWPREG (region pill resolves on the polygon tap).
    outFieldsHint: [
      "OBJECTID",
      "NAME",
      "WEB_PAGE",
      "PDFMAP",
      "CAMPING",
      "BOAT_FAC",
      "HUNTING",
      "HUNT_ACCESS",
      "ACRES",
      "LATITUDE",
      "LONGITUDE",
    ],
  },
  // Point companion for `wildlife-management-areas`. Sibling
  // sublayer /7 (WMA Locations) on the same FWP Lands MapServer, drawn with the
  // wildlife-management-areas.png badge.
  {
    id: "wma-points",
    module: "access",
    title: "Wildlife Management Areas (POIs)",
    description: "Centroid markers for FWP-owned WMAs — paired with the WMA polygon layer.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/fwplnd/fwpLands/MapServer/7",
    source: "fwp-public-hub",
    sourceLabel: "FWP Lands",
    upstreamUrl: "https://fwp-gis.mt.gov/arcgis/rest/services/fwplnd/fwpLands/MapServer",
    freshness: "static",
    geometry: "point",
    icon: "point",
    defaultVisible: false,
    // Hidden from panel — the `engage-mt:wmas` composite owns the toggle row.
    hiddenFromPanel: true,
    backReferenceFor: ["hunt", "access"],
    // Same as state-parks-points: the centroid is the primary visible marker,
    // so it must carry every attribute WmaCard renders (Camp/Boat badges,
    // HUNT_ACCESS access notes, LAT/LON Directions link) — not just HUNTING.
    // Verified against fwpLands/MapServer/7?f=json.
    outFieldsHint: [
      "OBJECTID",
      "NAME",
      "WEB_PAGE",
      "PDFMAP",
      "HUNTING",
      "CAMPING",
      "BOAT_FAC",
      "HUNT_ACCESS",
      "ACRES",
      "LATITUDE",
      "LONGITUDE",
    ],
  },
  // ───── Authoritative-trails federation (Trail Explorer rewrite, 2026-06-09)
  // Six MT-trail feature services consumed live by the rewritten Trail
  // Explorer. The composite parent below is the user-facing toggle —
  // toggling it cascades to every child id. Each child layer still loads
  // its own FeatureLayer (the polylines on the map) and still routes
  // tap-query through the unified TrailCard renderer registered against
  // its layer id, so popups read as one design language across all six
  // agencies. All polyline, all government-owned, all anonymous-public
  // REST. The unified model + per-agency normalization live in the
  // TrailCard renderer (components/map/featureCards/cards/TrailCard.tsx +
  // core/agencyResolver.ts).
  {
    id: "engage-mt:trails",
    module: "access",
    title: "Trails",
    description:
      "Consolidated trail network — USDA Forest Service NFS Trails + NPS Glacier + NPS Yellowstone backcountry (with live closures) + Lewis & Clark County + Missoula County + City of Bozeman / GVLT. One toggle, one popup chrome, every polyline traceable to a public agency.",
    url: "",
    composite: [
      "trails-usfs-nfs",
      "trails-nps-glacier",
      "trails-nps-yellowstone",
      "trails-lewis-clark",
      "trails-missoula-county",
      "trails-bozeman-gvlt",
    ],
    source: "external-public",
    sourceLabel: "USFS + NPS + MT counties",
    upstreamUrl: "https://www.fs.usda.gov/visit/destination/trails",
    freshness: "weekly",
    geometry: "line",
    defaultVisible: false,
    icon: "trail",
  },
  {
    id: "trails-usfs-nfs",
    module: "access",
    // Hidden from the panel; surfaced via the
    // `engage-mt:trails` composite above. FeatureLayer still loads on
    // the map + routes tap-query through TrailCard.
    hiddenFromPanel: true,
    title: "USFS National Forest System Trails",
    description: "USDA Forest Service trail inventory — statewide MT coverage with per-use flags.",
    url: "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TrailNFSPublish_01/MapServer/0",
    source: "external-public",
    sourceLabel: "USDA Forest Service · EDW",
    upstreamUrl: "https://www.fs.usda.gov/visit/destination/trails",
    freshness: "weekly",
    geometry: "line",
    defaultVisible: false,
    minScale: 4_000_000,
    icon: "trail",
    backReferenceFor: ["access"],
    outFieldsHint: [
      "OBJECTID",
      "TRAIL_NAME",
      "TRAIL_NO",
      "SEGMENT_LENGTH",
      "GIS_MILES",
      "TRAIL_SURFACE",
      "TRAIL_CLASS",
      "ADMIN_ORG",
      "MANAGING_ORG",
      // Per-use "managed" season fields — non-empty means the use is open on
      // this trail. Drives the allowed-use chips on the TrailCard.
      "HIKER_PEDESTRIAN_MANAGED",
      "BICYCLE_MANAGED",
      "PACK_SADDLE_MANAGED",
      "MOTORCYCLE_MANAGED",
      "ATV_MANAGED",
      "SNOWMOBILE_MANAGED",
      "SNOWSHOE_MANAGED",
      "XCOUNTRY_SKI_MANAGED",
    ],
    // National USFS trail service (all forests). No reliable state field, so
    // clip the FeatureLayer to the Montana polygon — trails on out-of-state
    // forests within the pan buffer leave the render + tap-query.
    montanaClip: "feature",
  },
  {
    id: "trails-nps-glacier",
    module: "access",
    hiddenFromPanel: true,
    title: "Glacier NP Trails",
    description: "National Park Service trail inventory for Glacier National Park.",
    url: "https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/GLAC_Trails_2019/FeatureServer/3",
    source: "external-public",
    sourceLabel: "NPS · Glacier NP",
    upstreamUrl: "https://www.nps.gov/glac/planyourvisit/hiking-trails.htm",
    freshness: "weekly",
    geometry: "line",
    defaultVisible: false,
    icon: "tree",
    outFieldsHint: ["OBJECTID", "NAME", "TRAILROUTE", "CLASS", "STATUS", "Miles", "DESC_SEG"],
    // Glacier National Park lies wholly within Montana — the service returns
    // only in-state trails, so no clip/filter is needed.
    montanaScopeNote:
      "Glacier NP is entirely within Montana; the service is intrinsically MT-only.",
  },
  {
    id: "trails-nps-yellowstone",
    module: "access",
    hiddenFromPanel: true,
    title: "Yellowstone NP Trails (backcountry)",
    description:
      "National Park Service backcountry trails for Yellowstone NP — carries live closure-date fields.",
    url: "https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/YELL_BACKCOUNTRY_STATUS_TRAILS_public_view/FeatureServer/1",
    source: "external-public",
    sourceLabel: "NPS · Yellowstone NP",
    upstreamUrl: "https://www.nps.gov/yell/planyourvisit/backcountryhiking.htm",
    freshness: "daily",
    geometry: "line",
    defaultVisible: false,
    icon: "tree",
    outFieldsHint: [
      "OBJECTID",
      "TRLNAME",
      "TRLALTNAME",
      "Status",
      "Status_Comments",
      "ClosureDate_Begin",
      "ClosureDate_End",
    ],
    // Yellowstone backcountry spans MT/WY/ID (mostly WY). Clip the FeatureLayer
    // to the Montana polygon so only the northern MT segments render + tap.
    montanaClip: "feature",
  },
  {
    id: "trails-lewis-clark",
    module: "access",
    hiddenFromPanel: true,
    title: "Lewis & Clark County Trails",
    description:
      "Lewis & Clark County / City of Helena South Hills trail network — includes ratings and photos.",
    url: "https://helenamontanamaps.org/arcgisadp/rest/services/OpenData/ODTrails/MapServer/1",
    source: "external-public",
    sourceLabel: "Lewis & Clark County · Open Data",
    upstreamUrl: "https://gisdata-helenamtmaps.opendata.arcgis.com/",
    freshness: "static",
    geometry: "line",
    defaultVisible: false,
    icon: "trail",
    outFieldsHint: [
      "OBJECTID",
      "NAME",
      "Trail_Type",
      "Surface",
      "Condition",
      "Status",
      "Admin_Org",
      "Rating",
      "Length_Mi",
      "Photo",
    ],
    // Lewis & Clark County / City of Helena service — a single Montana county's
    // trail inventory; intrinsically MT-only.
    montanaScopeNote: "Lewis & Clark County (MT) open-data service; intrinsically MT-only.",
  },
  {
    id: "trails-missoula-county",
    module: "access",
    hiddenFromPanel: true,
    title: "Missoula County Trails",
    description:
      "Missoula County ParksAndTrails — richest local schema: ADA, dog/seasonal restrictions, surface, ownership.",
    url: "https://gis.missoulacounty.us/arcgis/rest/services/CAPS/ParksAndTrails/MapServer/1",
    source: "external-public",
    sourceLabel: "Missoula County GIS",
    upstreamUrl: "https://gis.missoulacounty.us/",
    freshness: "static",
    geometry: "line",
    defaultVisible: false,
    icon: "trail",
    outFieldsHint: [
      "OBJECTID",
      "trail_name",
      "park_name",
      "trail_class",
      "use_restrict",
      "difficulty",
      "ada_accessible",
      "surface_type",
      "trail_miles",
      "maintenance_agency",
    ],
    // Missoula County (MT) trail inventory; intrinsically MT-only.
    montanaScopeNote: "Missoula County (MT) GIS service; intrinsically MT-only.",
  },
  {
    id: "trails-bozeman-gvlt",
    module: "access",
    hiddenFromPanel: true,
    title: "Bozeman / GVLT Trails",
    description:
      "City of Bozeman + Gallatin Valley Land Trust paved + dirt path + bike-lane network.",
    // Group layer is fanned out across sublayers 8/9/10 by the trail
    // adapter; this LayerDef points at the parent service so LayerPanel
    // shows one row. The adapter handles the sublayer fan-out.
    url: "https://gisweb.bozeman.net/arcgis/rest/services/Public/GVLT/MapServer/8",
    source: "external-public",
    sourceLabel: "City of Bozeman / GVLT",
    upstreamUrl: "https://gvlt.org/trails/",
    freshness: "static",
    geometry: "line",
    defaultVisible: false,
    icon: "trail",
    outFieldsHint: [
      "OBJECTID",
      "TrailSyst",
      "Ownership",
      "LENGTH_MILES",
      "MATERIAL",
      "CONDITION",
      "TRAIL_NETWORK",
    ],
    // City of Bozeman + Gallatin Valley Land Trust (MT) network; intrinsically
    // MT-only.
    montanaScopeNote: "City of Bozeman / GVLT (MT) service; intrinsically MT-only.",
  },
];
