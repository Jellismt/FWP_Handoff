/**
 * @file iconSymbols.ts
 * @module engage-mt/map/symbology
 * @description Per-layer iconography. Replaces the
 *              generic module-accent circle with a meaningful glyph
 *              for every registered point layer. Glyphs are inlined
 *              Lucide-style SVG paths wrapped in a circular badge so
 *              they read at any zoom + against any basemap.
 *
 *              How it works:
 *                1. ICON_REGISTRY maps a layer id to `{ icon, color }`.
 *                2. `pictureMarkerForLayer(id, theme)` builds an inline
 *                   SVG, encodes it as a data URI, returns a
 *                   PictureMarkerSymbol properties object.
 *                3. Results are cached per `(id, theme)` so repeated
 *                   construction is free.
 *                4. The cluster renderer (cluster.ts) reads the same
 *                   registry so the cluster glyph matches per-feature
 *                   icons.
 *
 *              Cartographic design:
 *                - Circle badge, 28×28 base, lifted 1.5px white ring
 *                  (light mode) / 0.5px ring with subtle shadow (dark).
 *                - Glyph at 18×18 centered on the badge.
 *                - Colors read from brand tokens via `:root` CSS vars.
 *                - Agency colors (BLM orange, BOR blue, USFS green)
 *                  override the module accent where federal-agency
 *                  identity matters more than module grouping.
 *
 *              Bundle hygiene: the SVG path data is the only payload —
 *              no Lucide React import. Each icon is ~80 bytes of `d=`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-07-08
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export type IconTheme = "light" | "dark";

/**
 * Lucide-derived SVG path `d=` strings (lucide.dev, ISC license).
 * Each glyph is normalized to a 24×24 viewBox; the wrapping <svg>
 * renders them at 18×18 centered inside the 28×28 badge. Stroke
 * width is 2 for crispness at small sizes.
 */
/**
 * PNG row. References a pre-designed custom icon
 * that already carries its own colored disc + glyph. We re-wrap it in
 * the same 28×28 SVG envelope as the Lucide rows so the entire icon
 * pipeline (cluster glyph reuse, theme reactivity, size-by-scale
 * visual variable, per-(id, theme) cache) is shared.
 *
 *   - `imageUrl`   absolute path served from /web/public, e.g.
 *                  "/icons/layers/fishing-access-sites.png"
 *   - `ringColor`  the dominant brand color of the PNG; surfaced via
 *                  `iconColorForLayer()` so the cluster badge matches
 *                  the per-feature icon at zoom-out.
 *   - `accentRing` optional override: a thin colored ring drawn just
 *                  inside the white halo. Used for the three federal
 *                  agency variants of non-fwp-recreation-sites.png to
 *                  preserve BLM/BOR/USFS identity even though the inner
 *                  PNG is shared.
 */
interface PngIconSpec {
  kind: "png";
  imageUrl: string;
  ringColor: string;
  accentRing?: string;
  size?: number;
}

type IconSpec = PngIconSpec;

/**
 * Per-layer icon registry. The cardinal table that drives both the
 * per-feature symbology and the cluster glyph. Add a new point layer
 * by adding a row here.
 *
 * Agency colors for federal recreation sites (BLM / BOR / USFS) — each
 * uses the same `tent-tree` glyph but a distinct color so the legend
 * + cluster overlay read at a glance.
 */
/**
 * Path prefix for the custom PNG icon set. Files are kebab-case-layer-name.png,
 * 128×128 RGBA, served from /web/public/icons/layers/.
 */
const PNG = "/icons/layers";

/**
 * Cache-bust token appended to every icon PNG URL. The PNGs live in
 * `web/public/` and are served UNHASHED, so swapping an icon file keeps the
 * same URL — browsers (and the map's WebGL texture atlas) then keep serving the
 * old bitmap while a freshly-mounted legend swatch may show the new one, so the
 * map and legend appear to disagree. Because BOTH surfaces resolve their image
 * through `pictureMarkerForLayer` → `buildPngUrl` (the map renderer in
 * `symbology/points.ts` + `cluster.ts`, the legend in `swatch.tsx`), bumping
 * this one token re-points them to a new URL together — they refetch in
 * lockstep and can never drift. **Bump it whenever you replace any icon PNG.**
 */
const ICON_ASSET_VERSION = "2026-07-17";

export const ICON_REGISTRY: Record<string, IconSpec> = {
  // ──────────────────────────────────────────────────────────────────
  // Fish module hero points — custom PNG set
  // ──────────────────────────────────────────────────────────────────
  "fishing-access-sites": {
    kind: "png",
    imageUrl: `${PNG}/fishing-access-sites.png`,
    ringColor: "#35AC46", // FAS green
  },
  // USGS + DNRC stream gages share one gauge icon, matching the shared GageCard.
  "usgs-gages": {
    kind: "png",
    imageUrl: `${PNG}/stream-gages.png`,
    ringColor: "#DC2626", // gage red
  },
  "dnrc-stage-gages": {
    kind: "png",
    imageUrl: `${PNG}/stream-gages.png`,
    ringColor: "#DC2626",
  },
  "ais-inspection-stations": {
    kind: "png",
    imageUrl: `${PNG}/ais-watercraft-inspections.png`,
    ringColor: "#E8A41D", // inspection gold
  },
  // CWD check stations — sampling-magnifier PNG, wildlife-domain red ring.
  "cwd-check-stations": {
    kind: "png",
    imageUrl: `${PNG}/cwd-check-stations.png`,
    ringColor: "#b32530",
  },
  // License ambassadors — license-card PNG.
  "license-ambassadors": {
    kind: "png",
    imageUrl: `${PNG}/license-ambassadors.png`,
    ringColor: "#2D3748", // manage graphite
  },

  // ──────────────────────────────────────────────────────────────────
  // Access module — federal recreation sites share one PNG with per-
  // agency `accentRing` overrides so BLM / BOR / USFS identity reads
  // at a glance even with a shared inner icon. `fwp-access-program`
  // has no PNG equivalent and stays on the Lucide door-open glyph.
  // ──────────────────────────────────────────────────────────────────
  "fwp-access-program": {
    kind: "png",
    imageUrl: `${PNG}/fwp-access-program.png`,
    ringColor: "#046A38", // access green
  },
  "blm-recreation-sites": {
    kind: "png",
    imageUrl: `${PNG}/non-fwp-recreation-sites.png`,
    ringColor: "#FF8C1A", // non-fwp orange
    accentRing: "#E57200", // BLM orange
  },
  "bor-recreation-sites": {
    kind: "png",
    imageUrl: `${PNG}/non-fwp-recreation-sites.png`,
    ringColor: "#FF8C1A",
    accentRing: "#1976D2", // BOR blue
  },
  "usfs-recreation-sites": {
    kind: "png",
    imageUrl: `${PNG}/non-fwp-recreation-sites.png`,
    ringColor: "#FF8C1A",
    accentRing: "#2D5016", // USFS green
  },
  // Composite parent — collapses BLM + BOR + USFS into one panel row.
  // No `accentRing` → swatch.tsx skips the SVG <circle> overlay so the
  // boot renders naked (no agency-color ring). `ringColor` is required by
  // the type but is only consumed by `iconColorForLayer()` for cluster
  // glyphs; the composite owns no data itself so the cluster path never
  // fires for this id. Per-agency identity now lives in the popup card
  // subtitle + MetricCallout sub, not the icon.
  "federal-recreation-sites": {
    kind: "png",
    imageUrl: `${PNG}/non-fwp-recreation-sites.png`,
    ringColor: "#FF8C1A",
  },

  // ──────────────────────────────────────────────────────────────────
  // Shared cross-cut
  // ──────────────────────────────────────────────────────────────────
  "active-fires-points": {
    kind: "png",
    imageUrl: `${PNG}/fires.png`,
    ringColor: "#FF4500", // fire orange-red
  },
  // River mile markers — red-pin PNG rendered at ~1/4 the standard 28px so the
  // dense 1-mile cadence doesn't clutter the map. The legend swatch always
  // renders at its own fixed size, so the panel icon stays full-size.
  "river-mile-markers": {
    kind: "png",
    imageUrl: `${PNG}/river-mile-markers.png`,
    ringColor: "#DC2626",
    size: 7,
  },
  // Wind arrows — LEGEND ONLY. The map uses the custom windStationsRenderer
  // (getRenderer returns it before the icon-registry path is consulted), so this
  // entry only supplies the panel/legend swatch (the arrow PNG), leaving the
  // on-map speed-colored rotating arrows untouched.
  "engage-mt:wind-stations": {
    kind: "png",
    imageUrl: `${PNG}/wind-arrows.png`,
    ringColor: "#3B82C4",
  },
  // Mountain ranges — mountains PNG (map + legend).
  "mountain-ranges": {
    kind: "png",
    imageUrl: `${PNG}/mountain-ranges.png`,
    ringColor: "#64748B",
  },
  // Elevation contours — LEGEND ONLY. The layer is a Living Atlas vector-tile
  // layer, so the map pipeline never consults the icon registry for it; this
  // entry supplies the panel/legend swatch.
  "contours-elevation": {
    kind: "png",
    imageUrl: `${PNG}/contours.png`,
    ringColor: "#8B7355",
  },
  // Radar — LEGEND ONLY. Raster ImageServer; map rendering untouched.
  "noaa-radar-reflectivity": {
    kind: "png",
    imageUrl: `${PNG}/radar.png`,
    ringColor: "#3B82C4",
  },
  // Public Lands — LEGEND ONLY. Living Atlas vector-tile layer; map rendering
  // untouched.
  "public-land-ownership": {
    kind: "png",
    imageUrl: `${PNG}/public.png`,
    ringColor: "#046A38",
  },

  // ──────────────────────────────────────────────────────────────────
  // POI / centroid companions for polygon layers. State
  // Parks and WMAs each ship a paired upstream point sublayer (FWP
  // Lands /4 and /7) that mirrors the polygon dataset. The custom icons were
  // designed for those POIs; we wire them to the `*-points` LayerDefs
  // in `layers.ts`.
  // ──────────────────────────────────────────────────────────────────
  "state-parks-points": {
    kind: "png",
    imageUrl: `${PNG}/state-parks.png`,
    ringColor: "#338033", // park forest green
  },
  "wma-points": {
    kind: "png",
    imageUrl: `${PNG}/wildlife-management-areas.png`,
    ringColor: "#6A8B45", // WMA sage
  },

  // ──────────────────────────────────────────────────────────────────
  // DEFERRED FINGood icons — files copied to /web/public/icons/layers/
  // but not yet wired because the matching EngageMT layer is either a
  // raster or doesn't exist yet:
  //   - radar.png                     raster (shared/weather radar)
  //   - river-miles.png               no river-mile-marker point layer yet
  // Wire each when its layer lands.
  // ──────────────────────────────────────────────────────────────────
};

/**
 * Per-(layerId, theme) cache so we only construct each SVG data URI
 * once. Theme reactivity: the cache key includes theme so light + dark
 * versions coexist.
 */
const cache = new Map<string, PictureMarkerSymbolWithType>();

/**
 * Returns the dominant brand color of a spec — used by the cluster
 * glyph + legend swatch dispatch.
 */
const resolveSpecColor = (spec: IconSpec): string => spec.accentRing ?? spec.ringColor;

const sizeFor = (spec: IconSpec): number => spec.size ?? 28;

/**
 * PNG-row "builder". The custom PNG set was hand-designed with
 * colored discs + glyphs baked in (FAS green, AIS gold,
 * etc.), so an extra theme halo is redundant. We hand the PNG URL
 * straight to the PictureMarkerSymbol; ArcGIS resolves it as a regular
 * image asset (no data: sandbox, browser caches it separately, no
 * base64 blowup in the symbol).
 *
 * Theme reactivity: PNG rows look identical in light + dark mode (the artwork
 * is designed for both). The per-(id, theme) cache still keys
 * by theme so callers can flip without coordinated invalidation, but
 * both entries resolve to the same `imageUrl`.
 *
 * Per-agency distinction (BLM / BOR / USFS share one PNG): we rely on
 * `iconColorForLayer()` returning the agency color, which the cluster
 * renderer reads — so cluster badges differentiate the three agencies
 * even though their per-feature PNG is shared. Matches the intent.
 */
const buildPngUrl = (spec: PngIconSpec): string => `${spec.imageUrl}?v=${ICON_ASSET_VERSION}`;

/** Every registry entry is a PNG row. */
const buildDataUri = (spec: IconSpec): string => buildPngUrl(spec);

/**
 * The shape we pass into a renderer's `symbol` slot. The ArcGIS
 * autocast treats `type: "picture-marker"` as the discriminator;
 * the official PictureMarkerSymbolProperties type omits `type` so
 * we declare a local shape with it explicit.
 */
export interface PictureMarkerSymbolWithType {
  type: "picture-marker";
  url: string;
  width: number;
  height: number;
}

/**
 * Returns the PictureMarkerSymbol properties for the given layer id +
 * theme, or null when no icon is registered for the layer (caller
 * should fall back to the generic geometry-default renderer).
 *
 * Theme reactivity: callers should re-call this whenever the theme
 * flips. The size-by-scale visual variable still applies via the
 * caller's renderer construction.
 */
export const pictureMarkerForLayer = (
  layerId: string,
  theme: IconTheme,
): PictureMarkerSymbolWithType | null => {
  const spec = ICON_REGISTRY[layerId];
  if (!spec) return null;
  const cacheKey = `${layerId}:${theme}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const size = sizeFor(spec);
  const symbolProps: PictureMarkerSymbolWithType = {
    type: "picture-marker",
    url: buildDataUri(spec),
    width: size,
    height: size,
  };
  cache.set(cacheKey, symbolProps);
  return symbolProps;
};

/**
 * Whether a layer has a registered icon. Used by the points renderer
 * + cluster module to branch between icon-backed and generic rendering.
 */
export const hasIconForLayer = (layerId: string): boolean => layerId in ICON_REGISTRY;

/**
 * Resolve the fill color the icon uses. Exported for the cluster glyph
 * so the cluster badge can match the per-feature icon color.
 */
export const iconColorForLayer = (layerId: string): string | null => {
  const spec = ICON_REGISTRY[layerId];
  if (!spec) return null;
  return resolveSpecColor(spec);
};

/**
 * Test helper / introspection — list of registered ids.
 */
export const REGISTERED_ICON_LAYERS: readonly string[] = Object.keys(ICON_REGISTRY);

/**
 * Clear the per-(id, theme) cache. Used by tests + by the theme
 * subscription in MapView to force-rebuild icons when the user flips
 * mode. Without this, the cached light-mode SVG would persist when
 * dark mode flips on.
 */
export const clearIconCache = (): void => {
  cache.clear();
};
