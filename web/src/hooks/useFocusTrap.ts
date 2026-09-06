/**
 * @file useFocusTrap.ts
 * @module engage-mt/hooks
 * @description Modal focus management for ad-hoc dialogs that aren't backed by
 *              Calcite (which traps focus on its own). Captures the previously
 *              focused element when `active` flips true, focuses the first
 *              focusable inside `containerRef`, traps Tab/Shift+Tab inside the
 *              container, restores focus to the original element on deactivate.
 *              Optionally calls `onEscape` when Esc is pressed.
 *
 * Extracted this pattern into a shared hook so
 *              Bespoke (non-Calcite) dialogs can reuse it
 *              rather than duplicating the trap loop.
 *
 *              Accessibility: while active, background content is marked
 *              `inert` (opt-out via `inertBackground: false`) so pointer and
 *              assistive-tech users cannot reach content behind the modal —
 *              WCAG 2.4.3 (Focus Order) + robustness.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-01
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, type RefObject } from "react";

// Includes-disabled-attr aware. `[tabindex]:not([tabindex="-1"])` keeps
// programmatically-only focusables out of the cycle.
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Options {
  active: boolean;
  // React 19 widened `useRef<T>(null)` to return `RefObject<T | null>` so
  // every consumer would have to spell that out. We accept the wider type
  // here so callers can pass either shape; the focus-trap body already
  // null-checks `containerRef.current` on every read.
  containerRef: RefObject<HTMLElement | null>;
  onEscape?: () => void;
  /**
   * Mark background content `inert` while the trap is active so pointer +
   * assistive-tech users can't reach content behind the modal. Defaults to
   * `true` (every current consumer is a modal dialog). Pass `false` for a
   * non-modal trap that should leave the rest of the page interactive.
   */
  inertBackground?: boolean;
}

export function useFocusTrap({
  active,
  containerRef,
  onEscape,
  inertBackground = true,
}: Options): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // Stash the trigger so we can restore it on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Remove background content from the AT tree + pointer interaction. Walk
    // the top-level body children and inert every one that isn't an ancestor
    // of the trapped container — this correctly leaves portal-rendered modals
    // (themselves body children) interactive. Only touch elements we set, and
    // record them so cleanup is exact even if others were already inert.
    const inerted: HTMLElement[] = [];
    if (inertBackground) {
      for (const el of Array.from(document.body.children)) {
        if (el instanceof HTMLElement && !el.contains(container) && !el.hasAttribute("inert")) {
          el.setAttribute("inert", "");
          inerted.push(el);
        }
      }
    }

    // Move focus into the dialog. Prefer the first interactive control;
    // fall back to the container itself.
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container.focus();
    }

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const current = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (current.length === 0) return;
      const first = current[0];
      const last = current[current.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (activeEl === first || !container.contains(activeEl))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (activeEl === last || !container.contains(activeEl))) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Restore the background we inerted (only the elements we touched).
      for (const el of inerted) el.removeAttribute("inert");
      // Restore focus to whatever opened the dialog. Guard against the
      // element having been removed from the DOM in the meantime.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef, onEscape, inertBackground]);
}
