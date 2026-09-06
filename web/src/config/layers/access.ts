/**
 * @file access.ts
 * @module engage-mt/config/layers
 * @description Access module layers: cadastral parcels, state trust land, BLM lands, block management areas, federal recreation sites.
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

export const ACCESS_LAYERS: readonly LayerDef[] = [
  // ───── Access module (new pillar) ─────────────────────────────────────────
  {
    // Below state trust; BMA is private land with
    // access-by-agreement, broader than a per-parcel answer.
    zIndex: 30,
    id: "bma-boundaries",
    module: "access",
    title: "Block Management Areas",
    description: "FWP-administered private lands open to public hunting via the BMA program.",
    url: "https://services3.arcgis.com/Cdxz8r11hT0MGzg1/arcgis/rest/services/FWPLND_BMA_BOUNDARY/FeatureServer/0",
    source: "fwp-public-hub",
    sourceLabel: "FWP Lands · BMA Program",
    upstreamUrl: "https://fwp.mt.gov/hunt/access/blockmanagement",
    freshness: "weekly",
    // FWP unpublishes the Block Management Area FeatureServices outside
    // the hunting season (they 404 until republished for next season).
    // Mark unavailable so the layer is never added to the map — no failed
    // request, so ArcGIS IdentityManager never pops a sign-in dialog —
    // and the panel shows an honest "offline" state. Remove this block
    // when FWP republishes.
    unavailable: {
      badge: "Offline",
      note: "Block Management is offline until the next hunting season, when FWP republishes the service.",
    },
    geometry: "polygon",
    // Off by load; BMA outlines are noise at state-wide zoom.
    // Cluster of sites becomes useful when the user is planning a hunt in
    // a region, so reveal from ~1:4M and tighter.
    defaultVisible: false,
    // Previously gated at 1:4M which hid BMA outlines at any
    // Montana-statewide view (~1:9M at zoom 6). User reported "BMA toggle
    // does nothing" because they were testing at the default statewide
    // zoom. Loosen the gate to 1:24M so the polygons render across the
    // useful interactive range (zoom 5 through zoom 18) while still
    // respecting some declutter for continent-scale views.
    minScale: 24_000_000,
    icon: "polygon",
    backReferenceFor: ["hunt"],
    // Permission overlay — sits on top of habitat layers as a "ask first"
    // Notice. Low-opacity fill + light outline. will add CIM hatch.
    symbology: { polygonRole: "overlay" },
    outFieldsHint: [
      "OBJECTID",
      "BMANUM",
      "BMANAME",
      "PTYPE",
      "REGION",
      "PDFMAP",
      "CLASS",
      "ACCESSINFO",
      "STATUS",
      "ENDDATE",
    ],
  },
  // Point companion for `bma-boundaries`. BMA exposes a
  // separate FWPLND_BMA_MAPPOINTS service whose /0 sublayer carries the
  // per-BMA centroid points. block-management-area.png badge.

  // Recreation site sublayers.
  // fishViewer/MapServer/45–48 expose FWP-mapped BLM / BOR / USFS rec sites +
  // the FWP Public Access Program inventory. AccessProgramCard renders
  // popups for any of these via the existing tap dispatcher.
  //
  // The BLM / BOR / USFS trio rolls up under `federal-recreation-sites`
  // (composite parent below) — to the user they're one mental category
  // ("non-FWP federal rec sites"). Each child still renders as its own
  // FeatureLayer + dispatches its own Tier-2 popup card; the parent
  // owns visibility cascade + the single naked-boot legend swatch.
  {
    id: "blm-recreation-sites",
    module: "access",
    title: "BLM recreation sites",
    description: "Bureau of Land Management developed recreation sites in Montana.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/fish/fishViewer/MapServer/45",
    source: "fwp-public-hub",
    sourceLabel: "BLM (via FWP)",
    upstreamUrl: "https://www.blm.gov/montana-dakotas",
    freshness: "static",
    geometry: "point",
    defaultVisible: false,
    icon: "point",
    backReferenceFor: ["explore"],
    symbology: { cluster: { enabled: true, disableAtZoom: 10 } },
    hiddenFromPanel: true,
  },
  {
    id: "bor-recreation-sites",
    module: "access",
    title: "BOR recreation sites",
    description: "Bureau of Reclamation recreation areas across Montana.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/fish/fishViewer/MapServer/46",
    source: "fwp-public-hub",
    sourceLabel: "BOR (via FWP)",
    upstreamUrl: "https://www.usbr.gov/gp/",
    freshness: "static",
    geometry: "point",
    defaultVisible: false,
    icon: "point",
    backReferenceFor: ["explore"],
    symbology: { cluster: { enabled: true, disableAtZoom: 10 } },
    hiddenFromPanel: true,
  },
  {
    id: "usfs-recreation-sites",
    module: "access",
    title: "USFS recreation sites",
    description: "U.S. Forest Service developed recreation sites in Montana.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/fish/fishViewer/MapServer/47",
    source: "fwp-public-hub",
    sourceLabel: "USFS (via FWP)",
    upstreamUrl: "https://www.fs.usda.gov/visit",
    freshness: "static",
    geometry: "point",
    defaultVisible: false,
    icon: "point",
    backReferenceFor: ["explore"],
    symbology: { cluster: { enabled: true, disableAtZoom: 10 } },
    hiddenFromPanel: true,
  },
  {
    id: "federal-recreation-sites",
    module: "access",
    title: "Federal recreation sites",
    description:
      "BLM, Bureau of Reclamation, and USFS developed recreation sites in Montana — one toggle for the full non-FWP federal rec inventory.",
    url: "",
    composite: ["blm-recreation-sites", "bor-recreation-sites", "usfs-recreation-sites"],
    source: "fwp-public-hub",
    sourceLabel: "BLM · BOR · USFS (via FWP)",
    freshness: "static",
    geometry: "point",
    defaultVisible: false,
    icon: "point",
    backReferenceFor: ["explore"],
  },
  {
    id: "fwp-access-program",
    module: "access",
    title: "FWP Public Access Program",
    description: "FWP-managed public access points — sign-in stations and program access entries.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/fish/fishViewer/MapServer/48",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Access Program",
    upstreamUrl: "https://fwp.mt.gov/hunt/access",
    freshness: "weekly",
    geometry: "point",
    defaultVisible: false,
    icon: "point",
    backReferenceFor: ["hunt", "fish"],
  },
  // Public Land Ownership overlay (Esri Living Atlas VTL).
  // Lives in the new "Reference" top group; default-visible at 0.55
  // opacity so the basemap imagery still reads through while the
  // BLM-yellow / USFS-green / state-trust / private color coding tells
  // users "whose land am I on" — mirroring the ownership story.
  {
    // Bottom of the access stack. Living Atlas VTL provides
    // visual tenure context but per-feature answers come from the
    // higher-specificity layers above.
    zIndex: 5,
    id: "public-land-ownership",
    panelRank: 1,
    module: "reference",
    title: "Public Lands",
    description:
      "Who owns the land under your feet — BLM yellow, USFS green, state trust pale yellow, private left blank. Useful for telling public from private at a glance.",
    url: "",
    portalItemId: "4e76d5cbbad045fe87265221293dfb90",
    source: "esri-living-atlas",
    sourceLabel: "Esri Living Atlas — Land Ownership",
    upstreamUrl: "https://www.arcgis.com/home/item.html?id=4e76d5cbbad045fe87265221293dfb90",
    freshness: "static",
    geometry: "vector-tile",
    defaultVisible: true,
    // Public-land colors should read even when
    // Zoomed. Bumped 0.55 → 0.8 for vibrancy. Safe now that the
    // ordered-insert (attachRegistryLayers) keeps this VTL BELOW the district
    // + parcel boundaries, so a stronger fill no longer buries them.
    opacity: 0.8,
    icon: "feature-layer",
    // Nationwide ownership VTL — no attribute to filter on and no client
    // polygon clip for vector tiles. Scoped by the translucent focus mask
    // (dimmed outside Montana). A hard VTL clip (GroupLayer + destination-in)
    // is a tracked follow-up.
    montanaScopeNote:
      "Living Atlas ownership VTL: no state field and no client polygon clip for vector tiles; dimmed outside MT by the focus mask.",
  },
  // Elevation contours as a toggleable overlay.
  // The `satellite`/`hybrid` basemaps carry no contour lines; the `topo-vector`
  // basemap already renders them natively, so this fills the gap for imagery
  // users without touching the basemap contract (a preference not everyone
  // wants). Esri Living Atlas "World Contours" VTL — publicly shared (owner
  // esri_vector, access:public), same anonymous-load risk class as
  // public-land-ownership above; loads via the portalItem branch in
  // attachRegistryLayers. Tiles serve from basemaps.arcgis.com (covered by the
  // *.arcgis.com CSP connect-src allowance). Default OFF; full opacity so the
  // brown contour lines + elevation labels stay crisp over dark imagery.
  {
    zIndex: 5,
    id: "contours-elevation",
    module: "reference",
    title: "Elevation contours",
    description:
      "Elevation contour lines with labels — reads terrain shape over satellite/hybrid imagery. The Topographic basemap already includes contours, so this overlay is aimed at the imagery basemaps.",
    url: "",
    portalItemId: "51ca3ce6a16d4080ad955dacd6dd2fe2",
    source: "esri-living-atlas",
    sourceLabel: "Esri Living Atlas — World Contours",
    upstreamUrl: "https://www.arcgis.com/home/item.html?id=51ca3ce6a16d4080ad955dacd6dd2fe2",
    freshness: "static",
    geometry: "vector-tile",
    defaultVisible: false,
    icon: "altitude",
    // Worldwide contour VTL — no client polygon clip for vector tiles;
    // dimmed outside Montana by the focus mask, default-off. Hard VTL clip
    // is a tracked follow-up.
    montanaScopeNote:
      "Living Atlas contour VTL: no client polygon clip for vector tiles; dimmed outside MT by the focus mask, default-off.",
  },
];
