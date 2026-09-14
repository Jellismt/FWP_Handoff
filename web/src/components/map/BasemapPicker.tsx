/**
 * @file BasemapPicker.tsx
 * @module engage-mt/map
 * @description — Basemap picker for the map tool rail. Replaces the
 *              earlier blind binary toggle (a single button that silently
 *              cycled satellite ↔ topo with no preview of what the other
 *              options were) with a discoverable popover. The trigger pill
 *              matches the rest of the rail; tapping it opens a labelled
 *              `role="radiogroup"` of the available basemaps so the user can
 *              SEE the choices and pick directly.
 *
 *              Accessibility (mirrors ColorPicker's roving-tabindex radiogroup
 *              + useFocusTrap): focus moves into the open popover, Tab is
 *              trapped, Esc closes and restores focus to the trigger, arrow
 *              keys cycle the options, each option is a 44px `role="radio"`.
 *              Closes on outside-click too. Color is never the only signal —
 *              the active option shows a check glyph and `aria-checked`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, Layers as LayersIcon, Mountain, Satellite } from "lucide-react";
import { useMapModeStore, type BasemapKey } from "@/store/map/mapModeStore";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { Tooltip } from "@/components/shared/overlays/Tooltip";
import { TOOLTIPS } from "@/copy/tooltips";
import "./BasemapPicker.css";

interface BasemapOption {
  key: BasemapKey;
  label: string;
  /** One-line plain-English description of what the basemap shows. */
  hint: string;
  icon: JSX.Element;
}

const OPTIONS: readonly BasemapOption[] = [
  {
    key: "satellite",
    label: "Satellite",
    hint: "Aerial imagery — no labels.",
    icon: <Satellite size={18} strokeWidth={2.25} aria-hidden />,
  },
  {
    key: "hybrid",
    label: "Hybrid",
    hint: "Aerial imagery with place and road labels.",
    icon: <LayersIcon size={18} strokeWidth={2.25} aria-hidden />,
  },
  {
    key: "topo-vector",
    label: "Topographic",
    hint: "Terrain, contours, and trails — easiest to read.",
    icon: <Mountain size={18} strokeWidth={2.25} aria-hidden />,
  },
];

export const BasemapPicker = (): JSX.Element => {
  const basemap = useMapModeStore((s) => s.basemap);
  const setBasemap = useMapModeStore((s) => s.setBasemap);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const panelId = useId();

  useFocusTrap({ active: open, containerRef: popoverRef, onEscape: () => setOpen(false) });

  // The popover is portaled to <body> so the rail's `overflow: hidden`
  // (it scrolls horizontally + masks its edges) can't clip it. Position it
  // with fixed coords anchored to the trigger: right-aligned to the trigger's
  // right edge, opening upward above the rail.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setCoords({
      position: "fixed",
      right: Math.round(window.innerWidth - r.right),
      bottom: Math.round(window.innerHeight - r.top + 8),
    });
  }, [open]);

  // Close on outside-click. The focus trap already owns Esc + Tab. Both the
  // trigger and the portaled popover count as "inside" — without the popover
  // check, a pointerdown on an option would close before its click fires.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const select = (key: BasemapKey): void => {
    setBasemap(key);
    setOpen(false);
  };

  const focusByIndex = (idx: number): void => {
    const wrapped = ((idx % OPTIONS.length) + OPTIONS.length) % OPTIONS.length;
    optionRefs.current[wrapped]?.focus();
  };

  const onOptionKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number): void => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        focusByIndex(idx + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        focusByIndex(idx - 1);
        break;
      case "Home":
        e.preventDefault();
        focusByIndex(0);
        break;
      case "End":
        e.preventDefault();
        focusByIndex(OPTIONS.length - 1);
        break;
    }
  };

  const active = OPTIONS.find((o) => o.key === basemap) ?? OPTIONS[0];

  return (
    <div className="basemap-picker">
      <Tooltip content={TOOLTIPS.mapToolBasemap} placement="left">
        <button
          ref={triggerRef}
          type="button"
          className={`map-tool-rail__button${open ? " map-tool-rail__button--active" : ""}`}
          aria-label={`Basemap: ${active.label}. Change basemap`}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {active.icon}
        </button>
      </Tooltip>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            id={panelId}
            className="basemap-picker__popover"
            role="radiogroup"
            aria-label="Choose a basemap"
            style={coords}
          >
            {OPTIONS.map((opt, idx) => {
              const selected = opt.key === basemap;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  ref={(el) => {
                    optionRefs.current[idx] = el;
                  }}
                  className={`basemap-picker__option${selected ? " basemap-picker__option--on" : ""}`}
                  onClick={() => select(opt.key)}
                  onKeyDown={(e) => onOptionKeyDown(e, idx)}
                >
                  <span className="basemap-picker__option-icon" aria-hidden>
                    {opt.icon}
                  </span>
                  <span className="basemap-picker__option-text">
                    <span className="basemap-picker__option-label">{opt.label}</span>
                    <span className="basemap-picker__option-hint">{opt.hint}</span>
                  </span>
                  {selected && (
                    <Check
                      size={16}
                      strokeWidth={3}
                      aria-hidden
                      className="basemap-picker__option-check"
                    />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
};
