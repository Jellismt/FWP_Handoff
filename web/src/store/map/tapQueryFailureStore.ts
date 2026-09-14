/**
 * @file tapQueryFailureStore.ts
 * @module engage-mt/store
 * @description Transient per-tap layer-query failure tracker. MapView's
 *              tap-to-query loop writes one entry per visible layer whose
 *              `queryFeatures()` rejected (CORS, scale-out-of-range,
 *              timeout, …); TapQueryPanel reads the entries to render an
 *              inline "N layers couldn't respond" chip alongside the
 *              successful results.
 *
 *              Failures auto-expire after `STALE_AFTER_MS` so a layer
 *              that recovers on the next tap doesn't carry forward a
 *              false alarm. The store is reset at the start of every
 *              tap, so chip counts reflect ONLY the most recent attempt.
 *
 * Of the remediation plan
 *              (replaces the silent `catch {}` at MapView.tsx:568).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";

export type TapQueryFailureReason = "timeout" | "network" | "unknown";

export interface TapQueryFailure {
  layerId: string;
  layerTitle: string;
  reason: TapQueryFailureReason;
  /** ISO timestamp of the failure. */
  at: string;
}

interface TapQueryFailureState {
  /** layerId → failure. Single failure per layer; rewrites on retry. */
  failures: Record<string, TapQueryFailure>;
  /** Mark a layer as having failed this tap. */
  recordFailure: (failure: TapQueryFailure) => void;
  /** Clear all failures (call at the start of every new tap). */
  clear: () => void;
}

export const useTapQueryFailureStore = create<TapQueryFailureState>((set) => ({
  failures: {},
  recordFailure: (failure) =>
    set((state) => ({
      failures: { ...state.failures, [failure.layerId]: failure },
    })),
  clear: () => set({ failures: {} }),
}));

/** Convenience selector for the panel: returns the list, newest first. */
export const selectFailureList = (state: TapQueryFailureState): readonly TapQueryFailure[] =>
  Object.values(state.failures).sort((a, b) => (a.at < b.at ? 1 : -1));
