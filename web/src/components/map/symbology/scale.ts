/**
 * @file scale.ts
 * @module engage-mt/map/symbology
 * @description Scale-dependent expression helpers. The map default extent
 *              is zoom 6 (scale ~9.2M) covering the whole state; users
 *              also operate at zoom 9–10 (town) and zoom 13–14 (block).
 *              Symbols sized appropriately at one zoom over-dominate or
 *              vanish at another. These helpers return ArcGIS Arcade
 *              `When(...)` expressions or SizeVariable objects.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-10
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/**
 * Equivalent SizeVariable object (preferred over Arcade for marker size
 * because it's faster + works with renderer auto-classification). Returns
 * an ArcGIS visualVariables entry.
 */
export const sizeByScaleVisualVariable = (
  baseSize: number,
): {
  type: "size";
  valueExpression: "$view.scale";
  stops: Array<{ value: number; size: number }>;
} => ({
  type: "size",
  valueExpression: "$view.scale",
  // Smaller scale = more zoomed in = bigger symbol; stops are scale (denom)
  stops: [
    { value: 250000, size: baseSize * 1.3 }, // zoom ~12
    { value: 1500000, size: baseSize }, // zoom ~9
    { value: 4000000, size: baseSize * 0.85 }, // zoom ~7
    { value: 9000000, size: baseSize * 0.7 }, // zoom ~6 (default extent)
  ],
});

/**
 * The same scale → size ramp as {@link sizeByScaleVisualVariable}, but
 * computed in plain JS for a given `$view.scale`. The renderer's size
 * visual variable only applies to layer features — graphics painted on a
 * standalone GraphicsLayer (e.g. the hover-halo overlay in `useMapHover`)
 * carry a single static symbol with no access to that variable. This
 * helper lets such overlays match the on-screen marker size at the current
 * scale so a ring drawn around a marker tracks it through zoom.
 *
 * Mirrors the visual variable's piecewise-linear interpolation across the
 * same four stops, clamping outside the range.
 */
export const markerSizeAtScale = (baseSize: number, scale: number): number => {
  const stops: ReadonlyArray<{ scale: number; factor: number }> = [
    { scale: 250000, factor: 1.3 },
    { scale: 1500000, factor: 1.0 },
    { scale: 4000000, factor: 0.85 },
    { scale: 9000000, factor: 0.7 },
  ];
  if (scale <= stops[0].scale) return baseSize * stops[0].factor;
  const last = stops[stops.length - 1];
  if (scale >= last.scale) return baseSize * last.factor;
  for (let i = 0; i < stops.length - 1; i += 1) {
    const lo = stops[i];
    const hi = stops[i + 1];
    if (scale >= lo.scale && scale <= hi.scale) {
      const t = (scale - lo.scale) / (hi.scale - lo.scale);
      return baseSize * (lo.factor + t * (hi.factor - lo.factor));
    }
  }
  return baseSize;
};
