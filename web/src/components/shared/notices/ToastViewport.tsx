/**
 * @file ToastViewport.tsx
 * @module engage-mt/shared
 * @description Renders the active toast queue. Mounted once at app root.
 *              Auto-dismiss honors per-toast duration (default 4s).
 *
 *              Per-toast timer tracking. The previous
 *              implementation rebuilt every timer in `useEffect` cleanup
 *              whenever the toasts array changed, which RESET the dismiss
 *              countdown for every visible toast each time a new one
 *              arrived. With a rapid producer (e.g. a tool firing two
 *              toasts per map tap), older toasts would linger far past
 *              their nominal duration and pile up behind a "+N" badge
 *              until they finally aged out together. Tracking timer ids
 *              per toast in a ref means each toast's countdown runs
 *              exactly once.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-06
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { CalciteAlert } from "@esri/calcite-components-react";
import { useToastStore, type Toast } from "@/store/app/toastStore";
import "./ToastViewport.css";

const DEFAULT_DURATION = 4000;

// Calcite 5 narrowed the icon prop type from `string` to a strict
// `IconName` union. All four values below ship in the Calcite icon set
// and render correctly at runtime; widening via `as never` here lets
// the literal strings flow into the prop without re-typing every
// CalciteAlert call site. The actual literal strings still validate
// against Calcite's icon catalog at runtime.
const ICON: Record<Toast["kind"], string> = {
  success: "check-square",
  info: "information",
  warning: "exclamation-mark-triangle",
  error: "exclamation-mark-circle",
};

export const ToastViewport = (): JSX.Element => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  // Per-toast timer id. We start a timer only for toasts that don't
  // already have one and clear timers for toasts that have been removed.
  const timersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const activeIds = new Set<string>();
    for (const t of toasts) {
      activeIds.add(t.id);
      const duration = t.duration ?? DEFAULT_DURATION;
      if (duration <= 0) continue;
      if (timersRef.current.has(t.id)) continue; // already counting down
      const handle = window.setTimeout(() => {
        dismiss(t.id);
        timersRef.current.delete(t.id);
      }, duration);
      timersRef.current.set(t.id, handle);
    }
    // Clear timers for toasts that no longer exist (already dismissed by
    // the user or the store).
    for (const [id, handle] of timersRef.current.entries()) {
      if (!activeIds.has(id)) {
        window.clearTimeout(handle);
        timersRef.current.delete(id);
      }
    }
  }, [toasts, dismiss]);

  // Belt-and-suspenders cleanup on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const handle of timers.values()) window.clearTimeout(handle);
      timers.clear();
    };
  }, []);

  return (
    <div className="toast-viewport" aria-live="polite">
      {toasts.map((t) => (
        <CalciteAlert
          key={t.id}
          open
          kind={t.kind === "error" ? "danger" : t.kind}
          icon={ICON[t.kind] as never}
          label={t.title}
          onCalciteAlertClose={() => dismiss(t.id)}
          scale="m"
        >
          <div slot="title">{t.title}</div>
          {t.message && <div slot="message">{t.message}</div>}
          {t.action && (
            <Link slot="link" to={t.action.to} onClick={() => dismiss(t.id)}>
              {t.action.label}
            </Link>
          )}
        </CalciteAlert>
      ))}
    </div>
  );
};
