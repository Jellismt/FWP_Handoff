/**
 * @file labels.ts
 * @module engage-mt/map/symbology
 * @description Sparse, zoom-gated label classes.
 *
 *              Cartographic principle: labels are figure-ground anchors,
 *              but the GIS default of "every feature labeled always" is
 *              the noise we are explicitly avoiding. Per Jamie's
 *              direction, labels only appear when the user is "super
 *              zoomed in" — concretely, zoom 12 and above for most
 *              layers (≈ scale 144,000 and tighter).
 *
 *              The function returns `LabelClass` JSON suitable for
 *              assignment to `layer.labelingInfo`. White halo on every
 *              label so they read against any basemap.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { LayerDef } from "@/types/layers";

/** Scale denominator at zoom 12 in Web Mercator (the "super-zoomed in"
 * threshold from the user direction). Anything wider than this scale
 * hides labels. Formula: 559082264.0287 / 2^12 ≈ 136,495. We round to
 * A clean 150,000 so the threshold matches the cluster-disable
 * scale and the visual transition feels coordinated. */
const SUPER_ZOOM_MAX_SCALE = 150000;

/** District-number labels appear the moment the district polygons draw —
 * matching the layer's own `minScale` (2,500,000, ≈ zoom 8) rather than
 * the super-zoom gate. Rationale: a hunter picks
 * a unit at region zoom; there are only ~180 districts statewide, so a
 * region view shows ~20-30 districts, each 100+ px across — 12px numbers
 * with static deconfliction stay comfortably sparse. The previous 150,000
 * gate meant numbers never appeared at the zoom people actually use. */
const DISTRICT_LABEL_MAX_SCALE = 2500000;

/** Parcel owner-name labels. Deep gate (≈ zoom 14):
 * town lots are 15-30 m wide, so at looser scales a 12px name is wider than
 * the parcel and static deconfliction drops most labels, producing a
 * random-subset look. At 1:36,000 rural sections (1 mi²) are ~45 px and
 * legible; in towns deconfliction thins gracefully. Never open this to the
 * cadastral layer's own minScale (100,000) — that is wall-to-wall clutter. */
const OWNER_LABEL_MAX_SCALE = 36000;

/** White-halo text symbol, used by every label class so they read on
 * any basemap (light or dark, vector or imagery). 12px is the floor
 * for typographic legibility on mobile per WCAG. */
const TEXT_SYMBOL = (color: [number, number, number, number] = [255, 255, 255, 1]) => ({
  type: "text",
  color,
  haloColor: [15, 20, 25, 0.85], // dark halo so white-on-light still reads
  haloSize: 1.25,
  font: { size: 12, family: "sans-serif", weight: "bold" },
});

const DARK_TEXT_SYMBOL = {
  type: "text",
  color: [15, 20, 25, 1],
  haloColor: [255, 255, 255, 0.95],
  haloSize: 1.5,
  font: { size: 12, family: "sans-serif", weight: "bold" },
};

/**
 * Resolve the label classes for a layer. Returns `null` when the layer
 * should not be labeled (the vast majority). Caller assigns to
 * `layer.labelingInfo` and `layer.labelsVisible = true`.
 */
export const labelClassesFor = (def: LayerDef): unknown[] | null => {
  switch (def.id) {
    case "hunting-districts":
    case "hunting-districts-antelope":
    case "hunting-districts-sheep":
    case "hunting-districts-moose":
    case "hunting-districts-goat":
    case "hunting-districts-upland-bird":
    case "hunting-districts-black-bear":
    case "hunting-districts-mountain-lion": {
      // District number — the one bit users want when zoomed in to a unit.
      // Field is `DISTRICT` on the FWP service (verified live 2026-07-07 via
      // ?f=json for admbnd/huntingDistricts). The
      // prior expression referenced a non-existent `HUNT_DIST`, so these
      // Labels had NEVER rendered —. Shown from the layer's own
      // draw scale, not super-zoom, so numbers appear where hunters look.
      return [
        {
          labelExpressionInfo: { expression: "$feature.DISTRICT" },
          symbol: DARK_TEXT_SYMBOL,
          minScale: DISTRICT_LABEL_MAX_SCALE,
          maxScale: 0,
          labelPlacement: "always-horizontal",
          deconflictionStrategy: "static",
        },
      ];
    }
    case "mt-cadastral": {
      // Parcel owner name — the ownership answer people want
      // without clicking. Empty-guarded (public parcels / water have blank
      // OwnerName) via the same Arcade `When(...)` pattern as major-rivers so
      // the map doesn't wallpaper blank labels. Owner labels belong on the
      // MSDI cadastral (the ownership source of record), NOT the Living Atlas
      // public-land VTL, which is a visual land-tenure layer only.
      return [
        {
          labelExpressionInfo: {
            expression: "When(IsEmpty($feature.OwnerName), null, $feature.OwnerName)",
          },
          symbol: DARK_TEXT_SYMBOL,
          minScale: OWNER_LABEL_MAX_SCALE,
          maxScale: 0,
          labelPlacement: "always-horizontal",
          deconflictionStrategy: "static",
        },
      ];
    }
    case "wildlife-management-areas":
    case "state-parks":
    case "bma-boundaries": {
      // Name when super-zoomed-in. Field varies per service.
      const fieldExpr =
        def.id === "wildlife-management-areas"
          ? "$feature.WMA_NAME"
          : def.id === "state-parks"
            ? "$feature.NAME"
            : "$feature.BMANAME"; // FWPLND_BMA_BOUNDARY/0 (verified 2026-06-07)
      return [
        {
          labelExpressionInfo: { expression: fieldExpr },
          symbol: TEXT_SYMBOL(),
          minScale: SUPER_ZOOM_MAX_SCALE,
          maxScale: 0,
          labelPlacement: "always-horizontal",
          deconflictionStrategy: "static",
        },
      ];
    }
    // Wind speed labels next to each arrow when super-zoomed
    // in. WIND_SPEED is the Living Atlas service attribute (already
    // consumed by WindStationCard for the popup). Rounded to integer +
    // " mph" suffix; placed above-right so the label doesn't overlap
    // the rotating arrow head.
    case "major-rivers":
    case "major-lakes": {
      // At super-zoom, render the river / lake name. The bundled datasets are
      // dissolved by name (one feature per river), and the handful of unnamed
      // connector arcs carry a null `name` — `When(...)` returns null for those
      // so they stay unlabelled rather than drawing empty label boxes.
      return [
        {
          labelExpressionInfo: {
            expression:
              "When(IsEmpty($feature.name) || Trim($feature.name) == '', null, $feature.name)",
          },
          symbol: TEXT_SYMBOL(),
          minScale: SUPER_ZOOM_MAX_SCALE,
          maxScale: 0,
          labelPlacement: "center-along",
          deconflictionStrategy: "static",
        },
      ];
    }
    case "engage-mt:wind-stations": {
      // Lowered minScale from SUPER_ZOOM_MAX_SCALE (≈ zoom 12)
      // to 750_000 (≈ zoom 10) so the mph readout is visible at typical
      // hunting / fishing zoom, not just super-zoom. The arrow color
      // already telegraphs the speed bucket; the label gives the exact
      // number for users who want to plan around it.
      return [
        {
          labelExpressionInfo: {
            expression: "Round($feature.WIND_SPEED) + ' mph'",
          },
          symbol: TEXT_SYMBOL([255, 255, 255, 1]),
          minScale: 750000,
          maxScale: 0,
          labelPlacement: "above-right",
          deconflictionStrategy: "static",
        },
      ];
    }
    // Fishing Access Sites are explicitly never
    // labeled. The previous "fall through to default null" left the
    // door open to confusion + meant Engage MT's null wasn't winning
    // over the service-side labelingInfo that FWP ships on the FAS
    // service. We now make the suppression unmistakable: explicit
    // case + the buildLayer factory pairs `labelingInfo = null +
    // labelsVisible = false` whenever this function returns null.
    // The FAS boundary polygon is paired with the point under the
    // `engage-mt:fishing-access-sites` composite; suppress its label too so
    // only the point badge carries identity.
    case "mountain-ranges": {
      // Physiographic orienting labels — named ranges as a wide-area cue.
      // Cartographic convention for a physical feature: uppercase italic in a
      // white-haloed tone, shown from the layer's own draw scale (region zoom,
      // its 3,000,000 minScale) rather than the super-zoom gate, since a range
      // name orients across a wide area. Field is `Name` (GNIS); empty-guarded.
      return [
        {
          labelExpressionInfo: {
            expression: "When(IsEmpty($feature.Name), null, Upper($feature.Name))",
          },
          symbol: {
            type: "text",
            color: [255, 255, 255, 1],
            haloColor: [15, 20, 25, 0.85],
            haloSize: 1.25,
            font: { size: 12, family: "sans-serif", weight: "normal", style: "italic" },
            // Small extra gap so the name sits just under the marker glyph, not
            // touching it (positive yoffset is up, so nudge down a touch).
            yoffset: -2,
          },
          minScale: 3000000,
          maxScale: 0,
          // Directly beneath the mountain marker (the PNG), not centered on it.
          labelPlacement: "below-center",
          deconflictionStrategy: "static",
        },
      ];
    }
    case "fishing-access-sites":
    case "fas-boundaries":
      return null;
    default:
      return null;
  }
};
