/**
 * @file Tooltip.tsx
 * @module engage-mt/shared
 * @description Lightweight, accessible tooltip used everywhere icon
 *              buttons or terse labels need a plain-English explanation
 *              on hover. Built so non-GIS users learn what
 *              "Draw" / "Measure" / "Locate" actually do.
 *
 *              Implementation choices, deliberate:
 *                - Custom (not Calcite). Calcite's wrapper is heavy
 *                  and the popover doesn't pierce shadow DOM cleanly
 *                  in our composition pattern.
 *                - Pure JSX + CSS transform. No popper.js dep. We
 *                  compute placement on hover via bounding rect.
 *                - 200ms reveal delay so quick mouse-overs don't
 *                  flash a tooltip; 0ms hide so dismissal feels snappy.
 *                - Dismisses on Escape, mouse-leave, blur, scroll.
 *                - Touch devices: tooltip suppressed entirely (touch
 *                  has no hover affordance and a long-press tap is
 *                  unintuitive); the wrapped child still works.
 *                - ARIA-compliant via `aria-describedby` linkage.
 *                - Respects prefers-reduced-motion (no fade).
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./Tooltip.css";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  /** The hover-explanation text (or rich node). Keep to ≤ 12 words. */
  content: ReactNode;
  /** Preferred placement. Defaults to "top". */
  placement?: TooltipPlacement;
  /** Delay before reveal (ms). Defaults to 200. */
  delayMs?: number;
  /** The element being explained. Must accept ref + ARIA props. */
  children: ReactElement;
}

const REVEAL_DELAY_DEFAULT_MS = 200;
const VIEWPORT_MARGIN_PX = 8;

const isTouchDevice = (): boolean =>
  typeof window !== "undefined" &&
  ("ontouchstart" in window || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));

/**
 * Tooltip wrapper. The child renders normally; on hover/focus the
 * explanation appears in a Portal positioned over the viewport.
 *
 * Usage:
 *   <Tooltip content="Find your location">
 *     <button><MapPin /></button>
 *   </Tooltip>
 */
export const Tooltip = ({
  content,
  placement = "top",
  delayMs = REVEAL_DELAY_DEFAULT_MS,
  children,
}: TooltipProps): JSX.Element => {
  const id = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const closeNow = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  };

  const scheduleOpen = (): void => {
    if (isTouchDevice()) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(true), delayMs);
  };

  // Position the tooltip every time it opens.
  useEffect(() => {
    if (!open || !triggerRef.current || !tooltipRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const tip = tooltipRef.current.getBoundingClientRect();
    let top = 0;
    let left = 0;
    switch (placement) {
      case "top":
        top = trigger.top - tip.height - 8;
        left = trigger.left + trigger.width / 2 - tip.width / 2;
        break;
      case "bottom":
        top = trigger.bottom + 8;
        left = trigger.left + trigger.width / 2 - tip.width / 2;
        break;
      case "left":
        top = trigger.top + trigger.height / 2 - tip.height / 2;
        left = trigger.left - tip.width - 8;
        break;
      case "right":
        top = trigger.top + trigger.height / 2 - tip.height / 2;
        left = trigger.right + 8;
        break;
    }
    // Viewport clamp.
    left = Math.max(
      VIEWPORT_MARGIN_PX,
      Math.min(left, window.innerWidth - tip.width - VIEWPORT_MARGIN_PX),
    );
    top = Math.max(
      VIEWPORT_MARGIN_PX,
      Math.min(top, window.innerHeight - tip.height - VIEWPORT_MARGIN_PX),
    );
    setPos({ top, left });
  }, [open, placement]);

  // Dismiss on Escape / scroll / window blur — anything that breaks the
  // hover context. Cheaper than tracking mouse coordinates.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") closeNow();
    };
    const onScroll = (): void => closeNow();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("blur", closeNow);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("blur", closeNow);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!isValidElement(children)) return children as unknown as JSX.Element;

  const child = children as ReactElement<{
    ref?: React.Ref<HTMLElement>;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    "aria-describedby"?: string;
  }>;

  // Compose hover/focus + describedby on the child element. We honor any
  // existing handlers by calling them after ours.
  const enhancedChild = cloneElement(child, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      // Preserve original ref if present. React 19 made `ref` a regular prop —
      // reading `element.ref` is removed and logs a deprecation, so take it
      // off props instead.
      const originalRef = child.props.ref;
      if (typeof originalRef === "function") originalRef(node);
      else if (originalRef && typeof originalRef === "object") {
        (originalRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
      child.props.onMouseEnter?.(e);
      scheduleOpen();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      child.props.onMouseLeave?.(e);
      closeNow();
    },
    onFocus: (e: React.FocusEvent) => {
      child.props.onFocus?.(e);
      scheduleOpen();
    },
    onBlur: (e: React.FocusEvent) => {
      child.props.onBlur?.(e);
      closeNow();
    },
    "aria-describedby": open ? id : child.props["aria-describedby"],
  });

  return (
    <>
      {enhancedChild}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            id={id}
            role="tooltip"
            className={`fwp-tooltip fwp-tooltip--${placement}`}
            style={pos ? { top: `${pos.top}px`, left: `${pos.left}px` } : { opacity: 0 }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
};
