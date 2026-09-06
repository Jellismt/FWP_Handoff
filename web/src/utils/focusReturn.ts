/**
 * @file focusReturn.ts
 * @module engage-mt/utils
 * @description Return keyboard focus to the element that opened a modal once it
 *              closes. Calcite dialogs restore focus on close, but our modals
 *              float over the ArcGIS MapView, which grabs focus for itself the
 *              moment a map overlay tears down — so Calcite's restore lands on
 *              the map surface instead of the trigger (e.g. the TipMont pill).
 *              We snapshot the trigger when the modal opens and re-assert focus
 *              on the next frames, AFTER the map's grab, so the trigger wins.
 *
 *              Single-slot by design: only one of these modals is open at a
 *              time, so a global remembered element is sufficient (and simpler
 *              than threading refs through stores). WCAG 2.4.3 Focus Order.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-20
 * @updated 2026-07-20
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

let remembered: HTMLElement | null = null;

/**
 * Snapshot the currently-focused element as the return target. Call this at the
 * moment a modal opens (from the opener action), before the dialog moves focus
 * into itself.
 */
export const rememberFocusTrigger = (): void => {
  const el = typeof document !== "undefined" ? document.activeElement : null;
  remembered = el instanceof HTMLElement && el !== document.body ? el : null;
};

/**
 * Return focus to the remembered trigger, if it still exists in the DOM. Runs
 * across two animation frames to land after both Calcite's own focus-restore
 * and the MapView's focus grab. No-op when nothing was remembered.
 */
export const returnFocusToTrigger = (): void => {
  const el = remembered;
  remembered = null;
  if (!el || typeof el.focus !== "function" || !el.isConnected) return;
  if (typeof requestAnimationFrame !== "function") {
    el.focus();
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => el.focus()));
};
