/**
 * @file hunt.ts
 * @module engage-mt/config/layers
 * @description Hunt module layers: hunting districts, species district portions, warden districts, check stations.
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

export const HUNT_LAYERS: readonly LayerDef[] = [
  // ───── Hunt module ────────────────────────────────────────────────────────
  // `hunting-districts` reads the FWP-GIS
  // admbnd/huntingDistricts service (the authoritative source). Big game,
  // antelope, sheep, moose, and mountain goat each have their own district
  // sets because the season + draw rules differ — added per-species
  // variants so users can pull up the boundary relevant to the species
  // they're scouting. General big-game (deer + elk shared) is the default-
  // visible "what district am I in" layer; species-specific are opt-in.
  //
  // Repointed every per-species URL from the parent Group
  // Layer (0–5) to the real Feature Layer sublayers. ArcGIS FeatureLayer
  // can't load a Group Layer — that was the source of every "Couldn't
  // load" toast on the Hunt module. Map of group → feature sublayer:
  //   General / Big Game   /0   → /11 (Deer Elk Lion Hunting Districts)
  //   Antelope             /1   → /3  (Antelope Hunting Districts)
  //   Bighorn Sheep        /2   → /5  (Bighorn Sheep Hunting Districts)
  //   Moose                /3   → /16 (Moose Hunting Districts)
  //   Mountain Goat        /4   → /19 (Mountain Goat Hunting Districts)
  //   Upland Bird          /5   → /31 (Upland Game Bird Districts)
  //
  // `outFieldsHint` is set on the
  // top-traffic layers (~90% of tap volume): all six hunting-district
  // variants + FAS + AIS + WMA + state parks + BMA + wildfire points.
  // Hints derived from each service's live `?f=json` metadata
  // (probed 2026-06-02) rather than guessing field names. Remaining
  // long-tail layers still default to `outFields: ["*"]` — overfetch
  // is bounded by their low tap volume.
  {
    id: "hunting-districts",
    module: "hunt",
    // All six variants collapse under one "Hunting Districts"
    // header in the LayerPanel; groupOrder puts the General/Big-Game
    // row at the top.
    subgroup: "Hunting Districts",
    groupOrder: 1,
    // Staff feedback: end users know these as "Deer/Elk" districts, not
    // "general / big game" — match the vocabulary hunters actually use.
    title: "Hunting Districts (Deer/Elk)",
    description:
      "The general big-game lens — deer, elk, and mountain lion district boundaries that drive most seasons and draws.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/11",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Hub",
    upstreamUrl: "https://gis-mtfwp.hub.arcgis.com/",
    freshness: "static",
    geometry: "polygon",
    // Calmer first paint. Hunting districts are useful but
    // visually loud at state-wide zoom; opt-in via the layer panel, then
    // shown only at region scale and tighter so the outlines don't crowd
    // the basemap at continent-level zooms either.
    defaultVisible: false,
    minScale: 2_500_000,
    icon: "layers",
    // Reference boundary — outline only, no fill. Lets the user see "what
    // district am I in" without occluding the basemap or stacking with
    // habitat fills (WMA / State Parks) and overlay fills (BMA).
    symbology: { polygonRole: "boundary" },
    // outFields whitelist derived from live service metadata
    // (admbnd/huntingDistricts/MapServer/11?f=json, 2026-06-02). Drops
    // tap-query overfetch on the highest-traffic Hunt layer.
    outFieldsHint: [
      "OBJECTID",
      "DISTRICT",
      "DEERWEBPAGE",
      "ELKWEBPAGE",
      "MAPLINK",
      "REG",
      "AREA_AC",
      "REGYEAR",
    ],
  },
  {
    id: "hunting-districts-antelope",
    module: "hunt",
    subgroup: "Hunting Districts",
    groupOrder: 2,
    title: "Hunting Districts — Antelope",
    description:
      "Pronghorn-specific hunting district boundaries. Antelope draws use a different district set than deer + elk.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/3",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Hub",
    upstreamUrl: "https://gis-mtfwp.hub.arcgis.com/",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "layers",
    symbology: { polygonRole: "boundary" },
    outFieldsHint: ["OBJECTID", "DISTRICT", "WEBPAGE", "MAPLINK", "REG", "AREA_AC", "REGYEAR"],
  },
  // District portions — sub-district areas where a rule applies to only part of an HD
  // (e.g. "Portion of HD 314 South of Rock Creek"). FWP-hosted per-species polygons,
  // keyed DISTRICT + SHAPECODE; tap resolution lives in resolvePortion.ts, these make
  // the boundaries visible/toggleable. No definitionExpression (FWP = statewide).
  {
    id: "district-portions-elk",
    module: "hunt",
    subgroup: "District Portions",
    groupOrder: 2,
    title: "District Portions — Elk",
    description:
      'Sub-district elk areas (e.g. "Portion of HD 314 South of Rock Creek") where a rule applies to only part of a district.',
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/14",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Hub",
    upstreamUrl: "https://gis-mtfwp.hub.arcgis.com/",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "layers",
    symbology: { polygonRole: "boundary" },
    outFieldsHint: ["OBJECTID", "DISTRICT", "SHAPECODE", "PORTIONNAME", "REG", "REGYEAR"],
  },
  {
    id: "district-portions-mule-deer",
    module: "hunt",
    subgroup: "District Portions",
    groupOrder: 2,
    title: "District Portions — Mule Deer",
    description: "Sub-district mule-deer areas where a rule applies to only part of a district.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/12",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Hub",
    upstreamUrl: "https://gis-mtfwp.hub.arcgis.com/",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "layers",
    symbology: { polygonRole: "boundary" },
    outFieldsHint: ["OBJECTID", "DISTRICT", "SHAPECODE", "PORTIONNAME", "REG", "REGYEAR"],
  },
  {
    id: "district-portions-white-tailed-deer",
    module: "hunt",
    subgroup: "District Portions",
    groupOrder: 2,
    title: "District Portions — White-tailed Deer",
    description:
      "Sub-district white-tailed-deer areas where a rule applies to only part of a district.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/13",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Hub",
    upstreamUrl: "https://gis-mtfwp.hub.arcgis.com/",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "layers",
    symbology: { polygonRole: "boundary" },
    outFieldsHint: ["OBJECTID", "DISTRICT", "SHAPECODE", "PORTIONNAME", "REG", "REGYEAR"],
  },
  {
    id: "district-portions-antelope",
    module: "hunt",
    subgroup: "District Portions",
    groupOrder: 2,
    title: "District Portions — Antelope",
    description:
      "Sub-district antelope areas (e.g. north/south of the Yellowstone) where a rule applies to only part of a district.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/4",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Hub",
    upstreamUrl: "https://gis-mtfwp.hub.arcgis.com/",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "layers",
    symbology: { polygonRole: "boundary" },
    outFieldsHint: ["OBJECTID", "DISTRICT", "SHAPECODE", "PORTIONNAME", "REG", "REGYEAR"],
  },
  {
    id: "hunting-districts-sheep",
    module: "hunt",
    subgroup: "Hunting Districts",
    groupOrder: 3,
    title: "Hunting Districts — Bighorn Sheep",
    description:
      "Bighorn sheep hunting district boundaries. Sheep districts are highly restrictive — most are limited-draw only.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/5",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Hub",
    upstreamUrl: "https://gis-mtfwp.hub.arcgis.com/",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "layers",
    symbology: { polygonRole: "boundary" },
    outFieldsHint: ["OBJECTID", "DISTRICT", "WEBPAGE", "MAPLINK", "REG", "AREA_AC", "REGYEAR"],
  },
  {
    id: "hunting-districts-moose",
    module: "hunt",
    subgroup: "Hunting Districts",
    groupOrder: 4,
    title: "Hunting Districts — Moose",
    description: "Moose hunting district boundaries. Limited-draw only statewide.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/16",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Hub",
    upstreamUrl: "https://gis-mtfwp.hub.arcgis.com/",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "layers",
    symbology: { polygonRole: "boundary" },
    outFieldsHint: ["OBJECTID", "DISTRICT", "WEBPAGE", "MAPLINK", "REG", "AREA_AC", "REGYEAR"],
  },
  {
    id: "hunting-districts-goat",
    module: "hunt",
    subgroup: "Hunting Districts",
    groupOrder: 5,
    title: "Hunting Districts — Mountain Goat",
    description:
      "Mountain goat hunting district boundaries. Limited-draw only; districts mirror the Beartooth, Crazy, Madison, and Bitterroot complexes.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/19",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Hub",
    upstreamUrl: "https://gis-mtfwp.hub.arcgis.com/",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "layers",
    symbology: { polygonRole: "boundary" },
    outFieldsHint: ["OBJECTID", "DISTRICT", "WEBPAGE", "MAPLINK", "REG", "AREA_AC", "REGYEAR"],
  },
  {
    id: "hunting-districts-upland-bird",
    module: "hunt",
    subgroup: "Hunting Districts",
    groupOrder: 6,
    title: "Hunting Districts — Upland Bird",
    description:
      "Upland bird (pheasant, sharptail, Hungarian partridge) hunting district boundaries. Different season + bag limits per district.",
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/31",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Hub",
    upstreamUrl: "https://gis-mtfwp.hub.arcgis.com/",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "layers",
    symbology: { polygonRole: "boundary" },
    outFieldsHint: ["OBJECTID", "NAME", "WEBPAGE", "REG", "AREA_AC"],
  },
  {
    id: "hunting-districts-black-bear",
    module: "hunt",
    subgroup: "Hunting Districts",
    groupOrder: 7,
    title: "Hunting Districts — Black Bear",
    description:
      "Black bear hunting district boundaries. Spring and fall season structures vary by district.",
    // huntingDistricts/MapServer/10 = Black Bear Hunting Districts (layer
    // list probed 2026-07-01). Same admbnd service + schema as the other
    // species district variants above.
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/10",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Hub",
    upstreamUrl: "https://gis-mtfwp.hub.arcgis.com/",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "layers",
    symbology: { polygonRole: "boundary" },
    outFieldsHint: ["OBJECTID", "DISTRICT", "WEBPAGE", "MAPLINK", "REG", "AREA_AC", "REGYEAR"],
  },
  {
    id: "hunting-districts-mountain-lion",
    module: "hunt",
    subgroup: "Hunting Districts",
    groupOrder: 8,
    title: "Hunting Districts — Mountain Lion",
    description:
      "Mountain Lion Management Units (LMUs) — the lion-specific boundaries FWP manages separately from the general deer/elk/lion districts.",
    // huntingDistricts/MapServer/21 = Mountain Lion Management Units
    // (probed 2026-07-01). This layer keys on NAME (not DISTRICT) — verified
    // against the sublayer ?f=json field list.
    url: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/21",
    source: "fwp-public-hub",
    sourceLabel: "FWP Public Hub",
    upstreamUrl: "https://gis-mtfwp.hub.arcgis.com/",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "layers",
    symbology: { polygonRole: "boundary" },
    outFieldsHint: ["OBJECTID", "NAME", "WEBPAGE", "REG", "AREA_AC", "REGYEAR"],
  },

  {
    // Item #3 — the wildlife-biologist counterpart of the fisheries layer, so
    // staff get the fish/wild toggle they asked for. FWP's hosted org publishes
    // this with real phone + email (which the on-prem fisheries layer lacks).
    id: "wildlife-biologist-coverage",
    module: "hunt",
    title: "Wildlife Biologist Areas",
    description:
      "FWP wildlife division responsibility areas — the biologist (with phone + email) covering each area.",
    url: "https://services3.arcgis.com/Cdxz8r11hT0MGzg1/arcgis/rest/services/ADMBND_RESPAREA_WILD/FeatureServer/0",
    source: "fwp-public-hub",
    sourceLabel: "FWP Wildlife Division",
    upstreamUrl: "https://fwp.mt.gov/aboutfwp/regional-info",
    freshness: "static",
    geometry: "polygon",
    defaultVisible: false,
    icon: "user",
    outFieldsHint: ["OBJECTID", "CONTACT", "AREANAME", "REGION", "TITLE", "PHONE", "EMAIL_ADDR"],
  },
];
