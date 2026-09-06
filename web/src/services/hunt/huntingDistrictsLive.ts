/**
 * @file huntingDistrictsLive.ts
 * @module engage-mt/services/hunt
 * @description Live ArcGIS REST lookup of hunting-district facts across every
 *              FWP species district set (Deer/Elk/Lion, Antelope, Bighorn
 *              Sheep, Moose, Mountain Goat, Upland Bird).
 *
 *              The bundled `hunting-district-facts` Tier-2 dataset only covers
 *              the 139 Deer/Elk/Lion general-license districts. A user who
 *              reaches a single-species district (e.g. Moose HD 106 from a map
 *              tap or a deep link) would otherwise dead-end at "No facts on
 *              file." This service fills that gap by querying the same public
 *              FWP-GIS services the map already renders — district number,
 *              region, acreage, and FWP's own per-district hunting-guide +
 *              district-map PDF links — for ANY district number, sourced live.
 *
 *              Public REST, anonymous request, no auth. Per docs/rules/
 *              arcgis.md the service URLs live in the layer registry, not
 *              inline. Per docs/rules/privacy.md the lookup sends only the
 *              public district number — no user location, no identifiers.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-01
 * @version 1.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { getLayerUrl } from "@/config/layers";
import { fetchFeatureById } from "@/services/public/arcgisFeature";
import { asString, asNumber } from "@/utils/arcgisAttrs";

/** A FWP species district set, its registry layer id, and its district-key field. */
interface SpeciesLayer {
  /** Registry layer id (URL source of truth in src/config/layers.ts). */
  layerId: string;
  /** Human-readable species label used for the badge row. */
  species: string;
  /** Attribute holding the district number on this layer. Upland uses NAME. */
  districtField: "DISTRICT" | "NAME";
}

// Mirrors the six hunting-district FeatureLayers registered in the layer
// registry. The Deer/Elk/Lion set leads so its (richer) web links win when a
// number is shared across species.
const SPECIES_LAYERS: readonly SpeciesLayer[] = [
  { layerId: "hunting-districts", species: "Deer / Elk / Lion", districtField: "DISTRICT" },
  { layerId: "hunting-districts-antelope", species: "Antelope", districtField: "DISTRICT" },
  { layerId: "hunting-districts-sheep", species: "Bighorn Sheep", districtField: "DISTRICT" },
  { layerId: "hunting-districts-moose", species: "Moose", districtField: "DISTRICT" },
  { layerId: "hunting-districts-goat", species: "Mountain Goat", districtField: "DISTRICT" },
  { layerId: "hunting-districts-upland-bird", species: "Upland Bird", districtField: "NAME" },
];

/** A single species' hold on a district, with FWP's own reference links. */
export interface LiveDistrictSpecies {
  species: string;
  /** FWP per-district species hunting guide (myfwp.mt.gov). */
  guideUrl: string | null;
  /** FWP per-district map PDF (fwp.mt.gov binaries). */
  mapUrl: string | null;
}

/** Synthesized facts for a district assembled live from FWP-GIS. */
export interface LiveDistrictFacts {
  district: string;
  /** FWP administrative region (1–7). 0 when the service omits it. */
  region: number;
  /** Largest per-species boundary acreage (species boundaries differ slightly). */
  acres: number;
  /** Every species whose district set includes this number, in registry order. */
  species: LiveDistrictSpecies[];
  /** Always the public FWP-GIS REST services. */
  source: string;
}

// Attribute narrowers now live in the shared utils/arcgisAttrs (audit
// dedup) — asString/asNumber are imported above.

/**
 * Look up a district number across every FWP species district set and return
 * a synthesized facts record, or `null` when no species layer carries it.
 *
 * Each layer is queried in parallel; an individual layer failure degrades to a
 * miss rather than failing the whole lookup, so a single slow/erroring service
 * never blocks the others.
 */
export const fetchDistrictFactsLive = async (
  district: string,
  signal?: AbortSignal,
): Promise<LiveDistrictFacts | null> => {
  const clean = district.trim();
  if (!clean) return null;

  const perLayer = await Promise.all(
    SPECIES_LAYERS.map(async (layer) => {
      try {
        // outFields="*" — the field set differs per layer (Deer/Elk/Lion
        // carries DEERWEBPAGE/ELKWEBPAGE, single-species layers carry WEBPAGE),
        // and ArcGIS 400s on an explicit field a layer doesn't define.
        const attrs = await fetchFeatureById({
          url: getLayerUrl(layer.layerId),
          where: `${layer.districtField} = '{id}'`,
          id: clean,
          outFields: ["*"],
          signal,
        });
        if (!attrs) return null;
        return { layer, attrs };
      } catch {
        // A single service hiccup shouldn't sink the whole lookup.
        return null;
      }
    }),
  );

  const hits = perLayer.filter(
    (h): h is { layer: SpeciesLayer; attrs: Record<string, unknown> } => h !== null,
  );
  if (hits.length === 0) return null;

  const region = hits.map((h) => asNumber(h.attrs.REG)).find((r): r is number => r !== null) ?? 0;
  const acres = Math.max(0, ...hits.map((h) => asNumber(h.attrs.AREA_AC) ?? 0));

  const species: LiveDistrictSpecies[] = hits.map(({ attrs, layer }) => ({
    species: layer.species,
    // Deer/Elk/Lion exposes split DEERWEBPAGE/ELKWEBPAGE + a shared MAPLINK;
    // single-species layers expose a single WEBPAGE. Prefer the species-
    // specific guide, falling back to the generic one.
    guideUrl: asString(attrs.WEBPAGE) ?? asString(attrs.DEERWEBPAGE),
    mapUrl: asString(attrs.MAPLINK),
  }));

  return {
    district: clean,
    region,
    acres,
    species,
    source: "FWP-GIS hunting district services (live)",
  };
};
