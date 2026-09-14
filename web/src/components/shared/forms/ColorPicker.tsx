/**
 * @file ColorPicker.tsx
 * @module engage-mt/shared
 * @description Brand-token color picker. Renders a swatch grid
 *              keyed against `WAYPOINT_COLOR_VAR` so every available
 *              waypoint/shape color flows through the live CSS variable
 *              (light/dark mode flip is automatic). Per
 *              [docs/rules/fwp-brand.md](../../../docs/rules/fwp-brand.md)
 *              — zero raw hex; readers resolve through the brand token.
 *
 *              ARIA: `role="radiogroup"` with roving tabindex; arrow keys
 *              cycle, Home/End jump to the ends. Each swatch is a real
 *              `<button role="radio">` with a 44px touch target wrapping a
 *              24px circular swatch so the visual stays minimalist while
 *              meeting WCAG 2.1 AA.
 *
 *              Designed to slot into editor surfaces (WaypointEditor,
 *              ShapeEditor) and as a quick-pick in tighter card chrome.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useRef, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { WAYPOINT_COLOR_VAR, type WaypointColorName } from "@/store/field/fieldToolsStore";
import "./ColorPicker.css";

/** Display label for each color name — shown as the swatch's accessible label. */
const COLOR_LABEL: Record<WaypointColorName, string> = {
  blue: "FWP blue",
  green: "Hunter green",
  orange: "Orange",
  yellow: "Gold",
  red: "Red",
  brown: "Brown",
  flow: "River blue",
  temp: "Warm orange",
  fire: "Fire red",
  fish: "Fish teal",
  park: "Forest green",
  snow: "Snow blue",
  wind: "Wind cyan",
  elev: "Elevation tan",
  drought: "Drought amber",
  mercury: "Mercury violet",
  wildlife: "Wildlife rust",
};

const ORDER: readonly WaypointColorName[] = [
  "blue",
  "green",
  "orange",
  "yellow",
  "red",
  "brown",
  "flow",
  "temp",
  "fire",
  "fish",
  "park",
  "snow",
  "wind",
  "elev",
  "drought",
  "mercury",
  "wildlife",
];

interface Props {
  /** Currently-selected color name. `null` means "use the kind's default." */
  value: WaypointColorName | null;
  onChange: (color: WaypointColorName | null) => void;
  /** Optional aria-label for the surrounding radiogroup. */
  label?: string;
  /**
   * When true, prefixes the grid with a "Use default" cell that clears the
   * override. Defaults to true — most editors want the off-state.
   */
  allowClear?: boolean;
}

export const ColorPicker = ({
  value,
  onChange,
  label = "Color",
  allowClear = true,
}: Props): JSX.Element => {
  const tabIdxs: readonly (WaypointColorName | null)[] = allowClear ? [null, ...ORDER] : ORDER;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusByIndex = (idx: number): void => {
    const wrapped = ((idx % tabIdxs.length) + tabIdxs.length) % tabIdxs.length;
    refs.current[wrapped]?.focus();
    onChange(tabIdxs[wrapped]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number): void => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        focusByIndex(idx + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        focusByIndex(idx - 1);
        break;
      case "Home":
        e.preventDefault();
        focusByIndex(0);
        break;
      case "End":
        e.preventDefault();
        focusByIndex(tabIdxs.length - 1);
        break;
    }
  };

  return (
    <div className="fwp-color-picker" role="radiogroup" aria-label={label}>
      {tabIdxs.map((c, idx) => {
        const selected = c === value;
        const cssVar = c ? WAYPOINT_COLOR_VAR[c] : undefined;
        const labelText = c ? COLOR_LABEL[c] : "Use kind default";
        return (
          <button
            key={c ?? "__default"}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={labelText}
            tabIndex={selected || (value == null && c === null) ? 0 : -1}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            className={`fwp-color-picker__swatch${selected ? " fwp-color-picker__swatch--on" : ""}${
              c === null ? " fwp-color-picker__swatch--default" : ""
            }`}
            style={cssVar ? ({ "--swatch-color": cssVar } as React.CSSProperties) : undefined}
            onClick={() => onChange(c)}
            onKeyDown={(e) => onKeyDown(e, idx)}
          >
            {selected && <Check size={14} strokeWidth={3} aria-hidden />}
            {c === null && !selected && (
              <span className="fwp-color-picker__default-glyph" aria-hidden>
                ⌀
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
