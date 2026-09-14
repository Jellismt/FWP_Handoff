/**
 * @file arcgisLayers.ts
 * @module engage-mt/shared
 * @description Canonical, single-source registry of the LIVE PUBLIC FWP ESRI
 *              hunting-district GIS layers that the tabular regs data links to by
 *              key. This is the one place the service URL + layer id + join field
 *              per geography is defined; the server seed/ETL import it and a static
 *              drift check (scripts/qc/check-gis-registry.mjs) asserts the web layer
 *              registry (web/src/config/layers.ts) agrees. Geometry lives ONLY in
 * These external ESRI layers — never in the regs DB.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** The three geometry-bearing regs entity kinds, each with a live public ESRI layer. */
export type ArcgisEntityKind = "district" | "portion" | "restricted_area";

export interface ArcgisLayerDef {
  /** Stable registry key (kebab-case), e.g. "hd-district", "antelope-portion". */
  readonly key: string;
  readonly entityKind: ArcgisEntityKind;
  /** MapServer sublayer id (bare number is meaningless without SERVICE_URL). */
  readonly layerId: number;
  /** Verbatim ArcGIS layer name (from the service `?f=json`). */
  readonly displayName: string;
  /**
   * Primary join attribute. Districts join on `DISTRICT` (Mtn Lion on `NAME`);
   * portions join to their parent district on `DISTRICT` (+ `SHAPECODE`/`PORTIONNAME`
   * for the specific portion); restricted areas identify on `PORTIONNAME` (+ `REG`).
   */
  readonly keyField: string;
  /** Portion/restricted only: the field naming the specific portion/area. */
  readonly subKeyField?: string;
  /** Human note on which species this layer serves. */
  readonly speciesScope: string;
  /** For district layers: the regs.geography code this backs (null for portions/rareas). */
  readonly geographyCode: string | null;
  /** ISO date the layer's field schema was probed against the live service. */
  readonly probedOn: string;
  /**
   * false = the layer NAME was confirmed from the service root but its field
   * schema was inferred from a same-kind sibling that WAS individually probed
   * (portions share the /4 schema; restricted areas share the /2 schema).
   */
  readonly schemaProbed: boolean;
}

/**
 * The authoritative FWP MapServer. Live + public (verified 2026-07-05).
 * The regs DB stores only codes + this reference; clients resolve geometry here.
 */
export const ARCGIS_HUNTING_DISTRICTS_SERVICE =
  "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer" as const;

/** Full REST URL for a layer (service base + sublayer id). */
export function arcgisLayerUrl(def: ArcgisLayerDef): string {
  return `${ARCGIS_HUNTING_DISTRICTS_SERVICE}/${def.layerId}`;
}

/**
 * Every hunting-district-family layer. District layer ids were probed 2026-06-02
 * (deer-elk/antelope/sheep/moose/goat/upland) and 2026-07-01 (bear/lion), and all
 * re-confirmed against the service root 2026-07-05. Antelope Portions (/4) and Big
 * Game Restricted (/2) field schemas were individually probed 2026-07-05; the other
 * portion/restricted layers share those schemas (schemaProbed=false until individually
 * confirmed — see scripts/qc/check-gis-registry.mjs).
 */
export const ARCGIS_HD_LAYERS: readonly ArcgisLayerDef[] = [
  // ── District boundaries (entityKind: district) ────────────────────────────
  { key: "hd-district", entityKind: "district", layerId: 11, displayName: "Deer Elk Lion Hunting Districts", keyField: "DISTRICT", speciesScope: "deer/elk/lion (general big game)", geographyCode: "HD", probedOn: "2026-06-02", schemaProbed: true },
  { key: "antelope-district", entityKind: "district", layerId: 3, displayName: "Antelope Hunting Districts", keyField: "DISTRICT", speciesScope: "antelope", geographyCode: "ANTELOPE_HD", probedOn: "2026-06-02", schemaProbed: true },
  { key: "sheep-district", entityKind: "district", layerId: 5, displayName: "Bighorn Sheep Hunting Districts", keyField: "DISTRICT", speciesScope: "bighorn sheep", geographyCode: "SHEEP_HD", probedOn: "2026-06-02", schemaProbed: true },
  { key: "moose-district", entityKind: "district", layerId: 16, displayName: "Moose Hunting Districts", keyField: "DISTRICT", speciesScope: "moose", geographyCode: "MOOSE_HD", probedOn: "2026-06-02", schemaProbed: true },
  { key: "goat-district", entityKind: "district", layerId: 19, displayName: "Mountain Goat Hunting Districts", keyField: "DISTRICT", speciesScope: "mountain goat", geographyCode: "GOAT_HD", probedOn: "2026-06-02", schemaProbed: true },
  // Upland districts key on NAME, not DISTRICT (probe caught this 2026-07-05) — same override case as Mtn Lion.
  { key: "upland-district", entityKind: "district", layerId: 31, displayName: "Upland Game Bird Districts", keyField: "NAME", speciesScope: "upland game birds", geographyCode: "UPLAND_HD", probedOn: "2026-07-05", schemaProbed: true },
  { key: "bear-district", entityKind: "district", layerId: 10, displayName: "Black Bear Hunting Districts", keyField: "DISTRICT", speciesScope: "black bear", geographyCode: "BEAR_HD", probedOn: "2026-07-01", schemaProbed: true },
  // Mtn Lion keys on NAME, not DISTRICT — the arcgis_key_fld override case.
  { key: "lion-mu", entityKind: "district", layerId: 21, displayName: "Mountain Lion Management Units", keyField: "NAME", speciesScope: "mountain lion", geographyCode: "LION_MU", probedOn: "2026-07-01", schemaProbed: true },

  // ── Portions (entityKind: portion) — parent join on DISTRICT, portion on SHAPECODE ─
  { key: "antelope-portion", entityKind: "portion", layerId: 4, displayName: "Antelope Portions", keyField: "DISTRICT", subKeyField: "SHAPECODE", speciesScope: "antelope", geographyCode: null, probedOn: "2026-07-05", schemaProbed: true },
  { key: "mule-deer-portion", entityKind: "portion", layerId: 12, displayName: "Deer Portions - Mule Deer", keyField: "DISTRICT", subKeyField: "SHAPECODE", speciesScope: "mule deer", geographyCode: null, probedOn: "2026-07-05", schemaProbed: true },
  { key: "wtd-portion", entityKind: "portion", layerId: 13, displayName: "Deer Portions - White-tailed Deer", keyField: "DISTRICT", subKeyField: "SHAPECODE", speciesScope: "white-tailed deer", geographyCode: null, probedOn: "2026-07-05", schemaProbed: true },
  { key: "elk-portion", entityKind: "portion", layerId: 14, displayName: "Elk Portions", keyField: "DISTRICT", subKeyField: "SHAPECODE", speciesScope: "elk", geographyCode: null, probedOn: "2026-07-05", schemaProbed: true },
  { key: "moose-portion", entityKind: "portion", layerId: 17, displayName: "Moose Portions", keyField: "DISTRICT", subKeyField: "SHAPECODE", speciesScope: "moose", geographyCode: null, probedOn: "2026-07-05", schemaProbed: true },
  { key: "upland-portion", entityKind: "portion", layerId: 32, displayName: "Upland Game Bird Portions", keyField: "DISTRICT", subKeyField: "SHAPECODE", speciesScope: "upland game birds", geographyCode: null, probedOn: "2026-07-05", schemaProbed: true },

  // ── Restricted areas (entityKind: restricted_area) — identify on PORTIONNAME, region on REG ─
  { key: "biggame-restricted", entityKind: "restricted_area", layerId: 2, displayName: "Big Game Restricted Areas", keyField: "PORTIONNAME", subKeyField: "REG", speciesScope: "deer/elk/antelope (big game)", geographyCode: null, probedOn: "2026-07-05", schemaProbed: true },
  { key: "elk-restricted", entityKind: "restricted_area", layerId: 15, displayName: "Elk Restricted Areas", keyField: "PORTIONNAME", subKeyField: "REG", speciesScope: "elk", geographyCode: null, probedOn: "2026-07-05", schemaProbed: true },
  { key: "moose-restricted", entityKind: "restricted_area", layerId: 18, displayName: "Moose Restricted Areas", keyField: "PORTIONNAME", subKeyField: "REG", speciesScope: "moose", geographyCode: null, probedOn: "2026-07-05", schemaProbed: true },
  { key: "upland-restricted", entityKind: "restricted_area", layerId: 33, displayName: "Upland Game Bird Restricted Areas", keyField: "PORTIONNAME", subKeyField: "REG", speciesScope: "upland game birds", geographyCode: null, probedOn: "2026-07-05", schemaProbed: true },
];

/** Look up a registry entry by its stable key. */
export function arcgisLayerByKey(key: string): ArcgisLayerDef | undefined {
  return ARCGIS_HD_LAYERS.find((l) => l.key === key);
}

/** District layers only (the ones that back a regs.geography row). */
export const ARCGIS_DISTRICT_LAYERS: readonly ArcgisLayerDef[] = ARCGIS_HD_LAYERS.filter(
  (l) => l.entityKind === "district",
);
