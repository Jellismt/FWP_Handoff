# ArcGIS Maps SDK 5.x — Engage MT Rules

## SDK choice

Use **ArcGIS Maps SDK for JavaScript 5.x** via `@arcgis/core` for programmatic
access (Map, MapView, Layer constructors, queries).

It is tree-shakeable. Import only what you use:

```ts
import Map from "@arcgis/core/Map";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
```

## Asset path

Set the SDK asset path once in `main.tsx` before any view mounts. **Derive the
version from the SDK itself** — never hardcode it — so the assets path can never
drift from the installed `@arcgis/core` (a mismatch triggers a worker
"Version mismatch" warning and can break rendering):

```ts
import esriConfig from "@arcgis/core/config";
import { version as ARCGIS_VERSION } from "@arcgis/core/kernel";
esriConfig.assetsPath = `https://js.arcgis.com/${ARCGIS_VERSION}/@arcgis/core/assets`;
```

(Currently `@arcgis/core` 5.x. The `index.html` ArcGIS theme CSS link carries
its own `MAJOR.MINOR` and must be bumped in lockstep; see `useTheme.ts`.)

## Layer registry

All layer definitions live in [`web/src/config/layers.ts`](../../web/src/config/layers.ts). Components reference layer IDs from the registry — never inline URLs in components. Registry shape:

```ts
type LayerSource = "fwp-public-hub" | "esri-living-atlas" | "fwp-internal" | "external";

interface LayerDef {
  id: string;                 // stable kebab-case id, e.g. "fishing-access-sites"
  module: "hunt" | "fish" | "explore" | "access" | "manage" | "shared" | "reference";
  title: string;              // human-readable, used in legend & toggles
  url: string;                // feature service URL
  source: LayerSource;
  defaultVisible: boolean;
  popupTemplate?: PopupTemplate;
  legendSymbol?: string;      // path to icon for layer panel
}
```

## Public FWP Hub layers (no auth)

Pull from `gis-mtfwp.hub.arcgis.com`. Initial POC set:

- BMA boundaries
- Hunting districts
- Fishing access sites (FAS)
- WMAs (Wildlife Management Areas)
- State parks

URLs go into the registry as they're confirmed. Until confirmed, leave a `// TODO: confirm URL` comment and a `WIP` flag on the LayerDef.

## Tap-to-query (regulation-aware point query)

`MapView.tsx` listens for the view's click event and runs `layerView.queryFeatures()` against all visible queryable layers at the tapped point. Results render in a Calcite `<calcite-panel>` side sheet with one section per layer that returned a hit. Group by module (Hunt regs first, then Fish, etc.).

**Spatial identification is client-side; only the resulting code goes to the regs API.** Hunting regs are *not* resolved server-side by geometry. The flow is: tap → query the live public FWP ESRI district layer client-side (`resolvePortion` / the district tap-query in `web/src/services/spatialContext/`) → get `DISTRICT=380` → ask the regs API for district 380's *tabular* regs. The regs database stores **no geometry** — it links to FWP's external ESRI layers by code (single source [`shared/src/arcgisLayers.ts`](../../shared/src/arcgisLayers.ts)). This holds through any future database migration: the GIS is FWP's ESRI service and never moves.

## Offline tiles

Strategy: **tile package via Capacitor Filesystem** for user-downloaded areas (mobile only). The web app has no offline tiles.

## Performance rules

- Lazy-load module-specific layers; only `shared` and the active module's `defaultVisible: true` layers load at startup.
- Use feature service `outFields` whitelists — never request `*` from large layers.
- Set `maxScale`/`minScale` on dense layers (FAS, BMA points) to fade them at far zoom.

## Layer z-order (draw order) — the reality

Draw order in a `Map` is **purely the `map.layers` collection order** — first added draws at the bottom, last on top. There is **no `z` property on `Layer`**: an assignment like `layer.z = def.zIndex` is a silent no-op the SDK ignores. `LayerDef.zIndex` is **documented intent only** — the actual order is set in [`attachRegistryLayers`](../../web/src/components/map/layerLifecycle/attachRegistryLayers.ts): synchronous layers mount in geometry-role priority order (habitat → boundary → default-polygon → overlay → line → point), and **async portal-item / raster layers must be positioned deliberately**, because a plain `map.add(layer)` in their `.then()` appends them *on top of everything* regardless of role. Bottom-of-stack reference VTLs (public-land ownership, contours) use `map.add(layer, 0)` so operational boundaries draw above them. If you need a layer at a specific depth, order the `map.add` — never reach for a phantom `z`.

## Symbology

Match FWP brand. Renderers are built in `web/src/components/map/symbology/` from the layer's own `LayerDef`, not hand-written per layer. Use brand tokens via CSS variables resolved at render time; for SDK renderers that require literal hex, resolve a token through `symbology/colors.ts` rather than inlining a hex value.

**Legend ↔ map parity is mandatory.** A layer's swatch and its rendered fill must
read from the **same source**, or they drift. Polygon layers do this through
`symbology/colors.ts`: `polygonColorsFor()` (legend swatch) and `polygonRenderer()`
(map) both consult `polygonAccentOverride()`, whose single source is
`POLYGON_ACCENT_OVERRIDES`. That table is where the on-brand layer accents live —
Hunting Districts → `--fwp-orange` `#E57200`, Game Warden Districts →
`--fwp-green-dark` `#046A38`, Waterbody Closures → `--fwp-red` `#C5283D` — mirrored
in [docs/rules/fwp-brand.md § map symbology](fwp-brand.md). Add a new accent there,
never in one function only.

**Hosted vector-tile layer (VTL) styles are forked after load, not overridden.**
Living Atlas VTLs (public-land ownership, the World Contours elevation layer) ship
their own style; to restyle them you read `layer.currentStyleInfo.style`, mutate the
relevant `layers[]` paint/layout, and re-apply with `layer.loadStyle()` — the Esri
best-practice, done in `attachRegistryLayers.ts`. Contours (`contours-elevation`)
use this to draw black contour lines and to make the elevation **labels** legible:
the stock `Contour_NN_main_text` layers ship olive `#61674A` at a small size, so we
force `text-color` to `#000000` and double the `text-size`. A VTL style edit is
invisible to the JSON-renderer path above — keep the two mechanisms distinct.

## Calcite-aware map UI

Map chrome (layer panel, tool rail, popups) is built on Calcite. Don't double-register Calcite components — see [docs/rules/calcite.md](calcite.md) for the single registration point.

## Narrowing feature attributes (the two intentional patterns)

ArcGIS REST returns a **schema-free `Record<string, unknown>`** attribute bag — field casing and value types vary by service (`NAME` / `Name` / `name`; numbers arriving as numeric strings; booleans as `0/1` or `"Yes"/"No"`). Two patterns here are **deliberate — do not "fix" them**:

1. **`Record<string, unknown>` for attribute bags is correct**, not laziness. There is no honest static type for a schema-free service response. Narrow at the top of the renderer / service; never trust a field is present or typed.
2. **The `esriCast` dual-cast (`as unknown as __esri.*`)** in [`web/src/utils/esriCast.ts`](../../web/src/utils/esriCast.ts) is the sanctioned workaround for the SDK's nominal `*Properties` types. Extend that file rather than writing a one-off `as unknown as` in calling code.

To narrow attribute values, use the shared, partial-data-tolerant helpers in [`web/src/utils/arcgisAttrs.ts`](../../web/src/utils/arcgisAttrs.ts) instead of re-implementing `String(a.NAME ?? a.Name ?? …)` / a local `asString`:

- `asString(v)` / `asNumber(v)` / `asBoolean(v)` — coerce a single value, returning `null` (never throwing) on missing/mistyped input.
- `attrStr(attrs, ["NAME", "Name", "name"], fallback)` / `attrNum(attrs, [...])` — first key that resolves, else the fallback. Use for the case-variant coalescing that recurs across feature-card `summary` functions.

They exist because the same narrowing was hand-rolled in 2+ services + dozens of renderers (the `esriCast` "if the shape appears in 2+ files, add a helper" bar). Adopt opportunistically when you touch a renderer/service — not as a mass rewrite.

## Montana scoping

Engage MT serves Montana only. Every LayerDef whose `source` is `external-public`
or `esri-living-atlas` MUST declare **one** of the strategies below — enforced by
`npm run check:montana-scoping` (`scripts/qc/check-montana-scoping.ts`, wired into
`verify`), which fails the build on any national layer with none of them.

> **The `MONTANA_CONSTRAINT_EXTENT` does NOT clip.** It is the map's pan/zoom
> `constraints.geometry` (a rectangular ~75-mi buffer, not the border) — it limits
> navigation, not rendering. The translucent focus mask
> (`montanaBoundaryMask.ts`) only *dims* outside Montana. Neither hides features.
> The earlier "raster/VTL are auto-clipped by the constraint extent" claim was a
> myth; real clipping is the `montanaClip` / `montanaScopeNote` fields below.

1. **`definitionExpression`** — a server-side state filter, when the service
   carries a state-coded field: `"POOState='US-MT'"` (NIFC), `"STATE_ADMN='MT'"`
   (BLM NLCS). Cheapest — out-of-state
   features never download. Applied at FeatureLayer construction in
   [buildLayer.ts](../../web/src/components/map/buildLayer.ts). Verify the exact
   field name via `curl '<service>?f=json' | jq .fields[].name` before guessing.
2. **`montanaClip: 'feature'`** — for a VECTOR FeatureLayer with **no** state
   field: a GPU-side `featureEffect` clips it to the Montana polygon in
   [attachRegistryLayers.ts](../../web/src/components/map/layerLifecycle/attachRegistryLayers.ts)
   via [montanaClip.ts](../../web/src/services/map/montanaClip.ts), so out-of-state
   features leave the render AND tap-query / clustering. Used by the Living Atlas
   wind stations, NIFC fire perimeters, and the national trail services.
   GroupLayer-aware (a portal item that resolves to a group is
   `loadAll()`ed and every child feature layer is clipped).
3. **`montanaScopeNote`** — a documented reason the layer is bounded another way:
   a raster / vector-tile layer that can't be feature-filtered (radar,
   public-land VTL, contours) stays dimmed by the focus mask + `minScale`;
   or a service intrinsically within Montana (Glacier NP, a MT county's trail
   feed). Prose only — it documents intent for the gate + future contributors.

> **Raster/VTL hard clip is a tracked follow-up.** The Esri "clip/mask" pattern
> (GroupLayer + a `blendMode:"destination-in"` Montana-fill mask) is the way to
> hard-clip raster/VTL, but an initial attempt destabilized the MapView render
> (blanked the basemap), so those layers currently use `montanaScopeNote` (dim)
> rather than a hard clip.

FWP / DNRC / MSDI / any `*.mt.gov` service is already statewide-MT at the service
level; do **not** set a scope field on those (the gate exempts `*.mt.gov` hosts).

Spatial-context point-in-polygon lookups against national services implicitly bound their result by the click geometry. As belt-and-suspenders, pass an optional `where` predicate to `queryAttributesAtPoint` ([web/src/services/spatialContext/queryAtPoint.ts](../../web/src/services/spatialContext/queryAtPoint.ts)) so an out-of-state caller resolves to `null` instead of a foreign feature.

When adding a national service whose state field is unfamiliar, drop a one-line comment with the verified field name + the date the schema was probed, so a future contributor can re-verify if the service rotates.
