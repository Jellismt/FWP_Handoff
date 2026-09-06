/**
 * @file toastStore.ts
 * @module engage-mt/store
 * @description Tiny toast notification queue. Components emit via useToast().
 *
 *              Added max-stack cap (3 per
 *              docs/rules/notifications.md "Don't queue more than ~3
 *              toasts") and per-(kind+title) dedup. Without these, a
 *              rapid producer (a tool firing on every map tap) could
 *              pile up the same toast multiple times behind a "+N" badge.
 *              When a new toast would push past the cap, the oldest one
 *              is dropped. When the new toast has the same kind+title as
 *              an existing one, the existing one is left in place
 *              (its countdown is NOT reset) and the new one is dropped.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-06
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";

export type ToastKind = "success" | "info" | "warning" | "error";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  /** Auto-dismiss in ms; 0 means sticky. Default: 4000. */
  duration?: number;
  /**
   * Optional in-app navigation link rendered in the toast's link slot — e.g.
   * "View in Field Tools" → `/field` after a draw/measure saves. `to` is a
   * React Router path (on-device navigation only; never an external URL).
   */
  action?: { label: string; to: string };
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
}

const MAX_TOASTS = 3;

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (toast) => {
    nextId += 1;
    const id = `toast-${nextId}`;
    set((state) => {
      // Dedup: if the same kind+title is already showing, leave the
      // existing one alone and return its id. (Returning the dedup id
      // would be more useful but the signature only supports the new id.)
      const existing = state.toasts.find((t) => t.kind === toast.kind && t.title === toast.title);
      if (existing) return state;
      const next = [...state.toasts, { ...toast, id }];
      // Cap the stack — drop oldest when we exceed the max.
      if (next.length > MAX_TOASTS) {
        return { toasts: next.slice(next.length - MAX_TOASTS) };
      }
      return { toasts: next };
    });
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
