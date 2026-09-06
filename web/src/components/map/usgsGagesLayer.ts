/**
 * @file usgsGagesLayer.ts
 * @module engage-mt/map
 * @description Builds the `usgs-gages` GraphicsLayer: one gauge marker per
 *              site in the bundled USGS catalog. Graphics carry a flat
 *              attribute shape (`site_no`, `name`, `river`, `source: "usgs"`)
 *              that the feature-card registry reads on tap; live readings are
 *              not bundled — the GageCard fetches them from NWIS when opened.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Point from "@arcgis/core/geometry/Point";
import { createLogger } from "@/utils/logger";
import { pictureMarkerForLayer, type IconTheme } from "./symbology/iconSymbols";
import { fetchUsgsGagesCatalog } from "@/services/data/usgsGagesCatalog";

const log = createLogger("usgsGagesLayer");
const LAYER_ID = "usgs-gages";
/** Zoom 8 at 96 dpi: a couple hundred gages read as a network, not a smear, from here in. */
export const GAGE_MIN_SCALE = 2_311_162;

/** Plain circle used only if the gauge icon fails to resolve. */
const FALLBACK_SYMBOL = {
  type: "simple-marker" as const,
  style: "circle" as const,
  size: 10,
  color: [25, 118, 210, 0.95] as [number, number, number, number],
  outline: { color: [255, 255, 255, 1] as [number, number, number, number], width: 1.5 },
};

export const buildUsgsGagesLayer = async (
  initialVisible: boolean,
  theme: IconTheme = "light",
): Promise<{ layer: GraphicsLayer }> => {
  const layer = new GraphicsLayer({
    id: LAYER_ID,
    title: "USGS gages",
    visible: initialVisible,
    listMode: "show",
    minScale: GAGE_MIN_SCALE,
  });
  let rows: Awaited<ReturnType<typeof fetchUsgsGagesCatalog>> = [];
  try {
    rows = await fetchUsgsGagesCatalog();
  } catch (err) {
    log.warn("Failed to load USGS gage catalog", { err: String(err) });
    return { layer };
  }
  // `pictureMarkerForLayer` caches per (layerId, theme), so resolve once and share.
  const symbol = pictureMarkerForLayer(LAYER_ID, theme) ?? FALLBACK_SYMBOL;
  for (const r of rows) {
    if (typeof r.lat !== "number" || typeof r.lon !== "number") continue;
    layer.add(
      new Graphic({
        geometry: new Point({ longitude: r.lon, latitude: r.lat }),
        attributes: {
          site_no: r.site_no,
          name: r.name,
          river: r.river ?? "",
          lat: r.lat,
          lon: r.lon,
          // The GageCard source dispatcher keys off `source`.
          source: "usgs",
        },
        symbol,
      }),
    );
  }
  log.info(`USGS gages layer populated with ${rows.length} markers`);
  return { layer };
};

/**
 * Re-apply the gauge marker for a new theme. Called from the map's theme
 * subscription so a dark/light flip swaps the marker along with every other
 * layer's renderer.
 */
export const applyUsgsGageTheme = (layer: GraphicsLayer, theme: IconTheme): void => {
  const symbol = pictureMarkerForLayer(LAYER_ID, theme);
  if (!symbol) return;
  layer.graphics.forEach((g) => {
    (g as unknown as { symbol: unknown }).symbol = symbol;
  });
};
