/**
 * @file ToolCluster.tsx
 * @module engage-mt/map
 * @description Grouped, expandable map-tool cluster for the MapToolRail
 *. Replaces the old flat strip of 14 pills with a few
 *              labelled clusters (Markup · Measure · Capture) in the modern
 *              outdoor-app idiom: a single rail pill that expands a popover menu
 *              of related tools. The trigger reflects the cluster's state — it
 *              lights up (and can pulse, for live capture) when a member tool
 *              is armed — so users read status without expanding.
 *
 *              Accessibility (mirrors BasemapPicker's roving-tabindex popover +
 *              useFocusTrap): the trigger is `aria-haspopup="menu"` +
 *              `aria-expanded`; the popover is `role="menu"` whose items are
 *              `menuitemradio` (tool-arming, mutually exclusive → `aria-checked`)
 *              or `menuitem` (one-shot actions like keyboard entry). Focus moves
 *              into the open menu, Tab is trapped, Esc closes and restores focus
 *              to the trigger, arrow keys cycle items, each row is a 44px target.
 *              Closes on outside-click. Color is never the only signal — the
 *              armed row shows a check glyph alongside `aria-checked`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-14
 * @version 1.0.1
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
import { Check } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { Tooltip } from "@/components/shared/overlays/Tooltip";
import "./ToolCluster.css";

export interface ToolClusterItem {
  /** Stable key for the row. */
  key: string;
  /** Short verb phrase — the visible row label + basis for the aria label. */
  label: string;
  /** One-line plain-English description of what the tool does. */
  hint: string;
  icon: JSX.Element;
  /**
   * Tool-arming rows pass a boolean here → the row is a `menuitemradio` whose
   * `aria-checked` tracks whether the tool is currently armed. One-shot action
   * rows (e.g. keyboard entry) leave it `undefined` → the row is a plain
   * `menuitem`.
   */
  checked?: boolean;
  /** Extra class(es) for the row — used by Record to layer its live state. */
  rowClassName?: string;
  /** Keep the menu open after selecting (e.g. a no-op live-recording row). */
  keepOpen?: boolean;
  onSelect: () => void;
}

interface ToolClusterProps {
  /** Cluster label used for the trigger aria-label + menu aria-label. */
  label: string;
  /** Full plain-English explanation shown on hover over the trigger. */
  tooltip: string;
  /** Representative icon for the collapsed trigger pill. */
  icon: JSX.Element;
  /** Any member tool armed → the trigger reads as "active". */
  active: boolean;
  /** Extra class(es) for the trigger pill — Capture passes its live state. */
  triggerClassName?: string;
  items: readonly ToolClusterItem[];
}

/**
 * A single expandable tool cluster. The popover is portaled to <body> (the rail
 * clips its own overflow) with fixed coords anchored to the trigger, opening
 * upward above the rail — identical placement to BasemapPicker.
 */
export const ToolCluster = ({
  label,
  tooltip,
  icon,
  active,
  triggerClassName,
  items,
}: ToolClusterProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  // Non-modal trap: the map + the rest of the rail stay interactive while the
  // cluster is open (this is a lightweight menu, not a blocking dialog).
  useFocusTrap({
    active: open,
    containerRef: popoverRef,
    onEscape: () => setOpen(false),
    inertBackground: false,
  });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setCoords({
      position: "fixed",
      right: Math.round(window.innerWidth - r.right),
      bottom: Math.round(window.innerHeight - r.top + 8),
    });
  }, [open]);

  // Close on outside-click. The focus trap owns Esc + Tab. Both the trigger and
  // the portaled popover count as "inside" so a pointerdown on a row doesn't
  // close before its click fires.
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

  const focusByIndex = (idx: number): void => {
    const wrapped = ((idx % items.length) + items.length) % items.length;
    itemRefs.current[wrapped]?.focus();
  };

  const onItemKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number): void => {
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
        focusByIndex(items.length - 1);
        break;
    }
  };

  const onSelect = (item: ToolClusterItem): void => {
    item.onSelect();
    if (!item.keepOpen) setOpen(false);
  };

  return (
    <div className="tool-cluster">
      <Tooltip content={tooltip} placement="left">
        <button
          ref={triggerRef}
          type="button"
          className={`map-tool-rail__button${active ? " map-tool-rail__button--active" : ""}${
            triggerClassName ? ` ${triggerClassName}` : ""
          }`}
          aria-label={`${label} tools`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {icon}
          {/* Armed indicator — suppressed when the trigger carries a live
              capture state (red/amber pill), where a yellow dot would clash. */}
          {active && !triggerClassName && <span className="tool-cluster__dot" aria-hidden="true" />}
        </button>
      </Tooltip>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            id={menuId}
            className="tool-cluster__popover"
            role="menu"
            aria-label={`${label} tools`}
            style={coords}
          >
            {items.map((item, idx) => {
              const isRadio = item.checked !== undefined;
              return (
                <button
                  key={item.key}
                  type="button"
                  role={isRadio ? "menuitemradio" : "menuitem"}
                  aria-checked={isRadio ? item.checked : undefined}
                  // Roving tabindex: the armed row (or the first row) is the
                  // single tab stop; arrows move focus between rows.
                  tabIndex={item.checked || (idx === 0 && !items.some((i) => i.checked)) ? 0 : -1}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  className={`tool-cluster__item${
                    item.checked ? " tool-cluster__item--on" : ""
                  }${item.rowClassName ? ` ${item.rowClassName}` : ""}`}
                  onClick={() => onSelect(item)}
                  onKeyDown={(e) => onItemKeyDown(e, idx)}
                >
                  <span className="tool-cluster__item-icon" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="tool-cluster__item-text">
                    <span className="tool-cluster__item-label">{item.label}</span>
                    <span className="tool-cluster__item-hint">{item.hint}</span>
                  </span>
                  {item.checked && (
                    <Check
                      size={16}
                      strokeWidth={3}
                      aria-hidden
                      className="tool-cluster__item-check"
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
