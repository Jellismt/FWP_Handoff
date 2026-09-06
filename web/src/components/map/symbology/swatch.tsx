/**
 * @file swatch.tsx
 * @module engage-mt/map/symbology
 * @description Inline-SVG symbology swatches for LayerPanel
 *              rows. Mirrors the on-map renderer at LayerPanel-row
 *              scale (14px) so the panel reads as a real legend
 *              instead of an abstract list of layer titles.
 *
 *              Resolution order:
 *                1. If the LayerDef (or, for composite parents, any of
 *                   its children) has an entry in `ICON_REGISTRY`, the
 *                   swatch renders that exact icon — the same custom PNG
 *                   or Lucide glyph the map paints — via
 *                   `pictureMarkerForLayer`. Agency variants
 *                   (BLM / BOR / USFS) get their `accentRing` drawn as
 *                   an outer stroke so the panel distinguishes them.
 *                2. Otherwise the geometry fallback:
 *                   - point  → filled circle in module accent
 *                   - habitat polygon → filled rect, accent fill + outline
 *                   - boundary polygon → outline-only rect
 *                   - overlay polygon → hatched rect (45° lines)
 *                   - line   → 2px line in accent
 *
 *              Theme reactivity: a `MutationObserver` on `<body>`'s
 *              `color-scheme` attribute repaints glyph swatches on
 *              dark-mode swap (mirrors the map symbol pipeline). PNG
 *              swatches look identical light + dark by design.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-17
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";

import type { LayerDef } from "@/types/layers";
import { LAYER_REGISTRY } from "@/config/layers";
import { lineColorFor } from "./lines";
import { polygonColorsFor } from "./polygons";
import { moduleAccentHex } from "./colors";
import { ICON_REGISTRY, pictureMarkerForLayer, type IconTheme } from "./iconSymbols";

const SWATCH_SIZE = 16;

const readBodyTheme = (): IconTheme => {
  if (typeof document === "undefined") return "light";
  return document.body?.getAttribute("color-scheme") === "dark" ? "dark" : "light";
};

/**
 * Subscribes to `<body color-scheme="…">` changes so swatches repaint
 * when the user flips dark mode. Mirrors the dark-mode invalidation
 * `MapView` performs against the on-map symbol cache.
 */
const useIconTheme = (): IconTheme => {
  const [theme, setTheme] = useState<IconTheme>(readBodyTheme);
  useEffect(() => {
    if (typeof document === "undefined" || !document.body) return;
    const observer = new MutationObserver(() => setTheme(readBodyTheme()));
    observer.observe(document.body, { attributes: true, attributeFilter: ["color-scheme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
};

/**
 * Direct hit on the LayerDef's own id, or — for composite parents like
 * `engage-mt:hydrology` — the first child id that has a registered
 * icon. Composite families share an icon by design (see iconSymbols.ts
 * comments around hydrology), so first match is correct.
 */
const resolveIconLayerId = (def: LayerDef): string | null => {
  if (def.id in ICON_REGISTRY) return def.id;
  if (def.composite) {
    for (const childId of def.composite) {
      if (childId in ICON_REGISTRY) return childId;
    }
  }
  return null;
};

/**
 * The LayerDef whose SYMBOLOGY the swatch should mirror. A composite parent
 * (e.g. `engage-mt:major-hydro`, `engage-mt:trails`) has no renderer of its
 * own — the map draws its children — so the legend has to read the child's
 * colours or it invents its own (the rivers legend drew the yellow module
 * accent while the map drew water-blue).
 */
const resolveStyleDef = (def: LayerDef): LayerDef => {
  if (!def.composite) return def;
  for (const childId of def.composite) {
    const child = LAYER_REGISTRY.find((d) => d.id === childId);
    if (child && child.geometry === def.geometry) return child;
  }
  const first = LAYER_REGISTRY.find((d) => d.id === def.composite?.[0]);
  return first ?? def;
};

export const LayerSwatch = ({ def }: { def: LayerDef }): JSX.Element => {
  const theme = useIconTheme();
  const iconLayerId = resolveIconLayerId(def);

  if (iconLayerId) {
    const symbol = pictureMarkerForLayer(iconLayerId, theme);
    const spec = ICON_REGISTRY[iconLayerId];
    if (symbol && spec) {
      const accentRing = spec.kind === "png" ? (spec.accentRing ?? null) : null;
      // PNG icons read too small at the default 14px swatch box — the
      // PNG raster glyphs have intrinsic padding so they look ~10px on
      // screen. Tag those swatches so CSS doubles their box (Lucide
      // glyph swatches stay at the legend-row size).
      const swatchClass =
        spec.kind === "png"
          ? "layer-panel__swatch layer-panel__swatch--png"
          : "layer-panel__swatch";
      return (
        <svg
          width={SWATCH_SIZE}
          height={SWATCH_SIZE}
          viewBox={`0 0 ${SWATCH_SIZE} ${SWATCH_SIZE}`}
          aria-hidden
          className={swatchClass}
        >
          <image
            href={symbol.url}
            x={0}
            y={0}
            width={SWATCH_SIZE}
            height={SWATCH_SIZE}
            preserveAspectRatio="xMidYMid meet"
          />
          {accentRing ? (
            <circle
              cx={SWATCH_SIZE / 2}
              cy={SWATCH_SIZE / 2}
              r={SWATCH_SIZE / 2 - 1}
              fill="none"
              stroke={accentRing}
              strokeWidth={1.5}
            />
          ) : null}
        </svg>
      );
    }
  }

  const size = SWATCH_SIZE;
  // Mirror the map: read the child's symbology for composite rows, and take
  // the colours from the same helpers the renderers use.
  const styleDef = resolveStyleDef(def);
  const role = styleDef.symbology?.polygonRole ?? def.symbology?.polygonRole;

  // Wildlife Biologist Areas — grey fill + white outline (matches the map).
  if (def.id === "wildlife-biologist-coverage") {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="layer-panel__swatch"
      >
        <rect
          x={1.5}
          y={1.5}
          width={size - 3}
          height={size - 3}
          rx={2}
          fill="#808080"
          fillOpacity={0.18}
          stroke="#ffffff"
          strokeWidth={1.5}
        />
      </svg>
    );
  }

  // Polygon variants — three roles
  if (def.geometry === "polygon") {
    const { fillHex, outlineHex } = polygonColorsFor(styleDef);
    if (role === "habitat") {
      return (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden
          className="layer-panel__swatch"
        >
          <rect
            x={1.5}
            y={1.5}
            width={size - 3}
            height={size - 3}
            rx={2}
            fill={fillHex}
            fillOpacity={0.24}
            stroke={outlineHex}
            strokeWidth={2}
          />
        </svg>
      );
    }
    if (role === "boundary") {
      return (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden
          className="layer-panel__swatch"
        >
          <rect
            x={1.5}
            y={1.5}
            width={size - 3}
            height={size - 3}
            rx={2}
            fill="none"
            stroke={outlineHex}
            strokeWidth={2}
          />
        </svg>
      );
    }
    if (role === "overlay") {
      // Hatched fill — mirrors the CIMHatchFill at 45°. Waterbody
      // closures use a red CROSS-hatch (both diagonals) to match the map.
      const isCrossHatch = def.id === "waterbody-closures";
      const patternId = `swatch-hatch-${def.id}`;
      return (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden
          className="layer-panel__swatch"
        >
          <defs>
            <pattern
              id={patternId}
              patternUnits="userSpaceOnUse"
              width={4}
              height={4}
              patternTransform="rotate(45)"
            >
              <line x1={0} y1={0} x2={0} y2={4} stroke={outlineHex} strokeWidth={1.25} />
              {isCrossHatch ? (
                <line x1={0} y1={0} x2={4} y2={0} stroke={outlineHex} strokeWidth={1.25} />
              ) : null}
            </pattern>
          </defs>
          <rect
            x={1.5}
            y={1.5}
            width={size - 3}
            height={size - 3}
            rx={2}
            fill={fillHex}
            fillOpacity={0.1}
            stroke={outlineHex}
            strokeWidth={1}
          />
          <rect
            x={1.5}
            y={1.5}
            width={size - 3}
            height={size - 3}
            rx={2}
            fill={`url(#${patternId})`}
            stroke="none"
          />
        </svg>
      );
    }
    // Default fallback — solid fill at low opacity.
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="layer-panel__swatch"
      >
        <rect
          x={1.5}
          y={1.5}
          width={size - 3}
          height={size - 3}
          rx={2}
          fill={fillHex}
          fillOpacity={0.18}
          stroke={outlineHex}
          strokeWidth={1.5}
        />
      </svg>
    );
  }

  if (def.geometry === "line") {
    const lineHex = lineColorFor(styleDef);
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="layer-panel__swatch"
      >
        <line
          x1={2}
          y1={size - 2}
          x2={size - 2}
          y2={2}
          stroke={lineHex}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Point — filled circle, 2px white outline if clustered (echoes the
  // cluster glyph) else 1px outline. Tells the user at a glance
  // "this layer clusters" vs. "this layer renders individual points."
  const isClustered = Boolean(def.symbology?.cluster?.enabled);
  const pointHex = moduleAccentHex(styleDef.module);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className="layer-panel__swatch"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={isClustered ? 5.5 : 4.5}
        fill={pointHex}
        fillOpacity={0.92}
        // Hard-coded white outline is intentional: this SVG is shown
        // over arbitrary map basemap and module-accent fill colors, so
        // a fixed white halo guarantees AA contrast on every brand
        // accent (#002855, #046A38, #744F28, #E57200, #FFC72C) and
        // every basemap tone. CSS theming would break that invariant.
        stroke="#ffffff"
        strokeWidth={isClustered ? 1.5 : 1}
      />
    </svg>
  );
};
