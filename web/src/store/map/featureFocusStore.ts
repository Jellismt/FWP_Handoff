/**
 * @file featureFocusStore.ts
 * @module engage-mt/store
 * @description R.4c — Co-located feature-focus stores. Two Zustand stores
 *              live here: `useTakeoverPopupStore` (full-screen detail modal)
 *              and `useHighlightedFeatureStore` (pulsing halo on the map).
 *
 *              Both describe "which feature is the user currently looking
 *              at" — takeover owns the modal slice, highlight owns the visual
 *              halo. They typically fire together (a search hit highlights
 *              the spot AND opens the takeover) but neither requires the
 *              other. Subscription isolation matters: closing the takeover
 *              shouldn't re-render highlight subscribers and vice versa.
 *
 *              `takeoverPopupStore.ts` + `highlightedFeatureStore.ts`
 *              re-export from here so existing imports keep working.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import type { TapPoint } from "@/types/featureCard";
import { rememberFocusTrigger } from "@/utils/focusReturn";

/* ── Takeover popup ─────────────────────────────────────────────────── */

interface TakeoverPopupState {
  open: boolean;
  layerId: string | null;
  layerTitle: string | null;
  module: string | null;
  attrs: Record<string, unknown> | null;
  tapPoint: TapPoint | null;
  openFeature: (input: {
    layerId: string;
    layerTitle: string;
    module: string;
    attrs: Record<string, unknown>;
    tapPoint?: TapPoint;
  }) => void;
  close: () => void;
}

export const useTakeoverPopupStore = create<TakeoverPopupState>((set) => ({
  open: false,
  layerId: null,
  layerTitle: null,
  module: null,
  attrs: null,
  tapPoint: null,
  openFeature: ({ layerId, layerTitle, module, attrs, tapPoint }) => {
    // Snapshot the opener (e.g. a search-result button) before the dialog moves
    // focus, so keyboard focus can return there on close (see TakeoverPopupPortal).
    rememberFocusTrigger();
    set({
      open: true,
      layerId,
      layerTitle,
      module,
      attrs,
      tapPoint: tapPoint ?? null,
    });
  },
  // Only flip `open` to false on close. Keeping layerId /
  // attrs / etc. populated lets CalciteDialog play its built-in exit
  // animation against still-mounted content; the values are fully
  // overwritten on the next openFeature() call, so no stale-leak risk.
  // Nulling them synchronously (as we did before) amputated the close
  // animation and left the compositor mid-frame, contributing to the
  // "map takes a beat to come back" perception bug.
  close: () => set({ open: false }),
}));

/* ── Highlighted feature halo ───────────────────────────────────────── */

export type HighlightKind = "waterbody" | "fas" | "point" | "polygon";

/**
 * Optional vector geometry painted briefly alongside the point halo —
 * the teal-flash affordance for selected waterbodies. Polygon rings
 * (lakes / reservoirs) and polyline paths (rivers / streams) are both
 * supported. Coordinates are WGS84 lon/lat tuples.
 */
export type HighlightGeometry =
  | { kind: "polygon"; rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>> }
  | { kind: "polyline"; paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>> };

export interface HighlightTarget {
  lat: number;
  lon: number;
  label: string;
  kind: HighlightKind;
  /** Wall-clock ms when the halo should self-clear. `Infinity` = persist until
   * `clear` is called explicitly (tap-query keeps the clicked
   *  feature outlined for as long as the result panel is open). */
  expiresAt: number;
  /** Optional vector geometry rendered briefly to make the feature legible. */
  geometry?: HighlightGeometry | null;
  /** Wall-clock ms when the geometry flash should fade out. Defaults to
   *  6 s after set (matches the reference). `Infinity` = never fade (persist with the
   *  point halo). The point halo persists until `expiresAt`. */
  geometryFadesAt?: number;
  /** Monotonic id stamped on every `set()`. The renderer keys its point
   *  re-pulse on this so two successive selections that happen to share a
   *  label (e.g. two "Cadastral parcels") don't collide and leave a stale
   *  highlight — the label/ring-count fingerprint alone is ambiguous. */
  seq: number;
}

interface HighlightedFeatureState {
  selected: HighlightTarget | null;
  set: (
    input: Omit<HighlightTarget, "expiresAt" | "geometryFadesAt" | "seq"> & {
      /** `Infinity` = persist until `clear()`. */
      ttlMs?: number;
      /** `Infinity` = never fade the geometry. */
      geometryFadeMs?: number;
    },
  ) => void;
  /** Update only the geometry slot of the current target — used when the
   *  geometry resolves *after* the halo was already set (search → click
   *  → fly-to → then geometry fetch resolves a beat later). No-op when
   *  no target is selected. */
  setGeometry: (geometry: HighlightGeometry | null, opts?: { geometryFadeMs?: number }) => void;
  clear: () => void;
}

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_GEOM_FADE_MS = 6_000;

/** Monotonic selection counter — see HighlightTarget.seq. */
let highlightSeq = 0;

export const useHighlightedFeatureStore = create<HighlightedFeatureState>((set, get) => ({
  selected: null,
  set: ({ lat, lon, label, kind, ttlMs, geometry, geometryFadeMs }) =>
    set({
      selected: {
        lat,
        lon,
        label,
        kind,
        // `Date.now() + Infinity === Infinity`, so an Infinity ttl/fade flows
        // straight through to a never-expiring target; the renderer guards on
        // Number.isFinite before scheduling any clear timer.
        expiresAt: Date.now() + (ttlMs ?? DEFAULT_TTL_MS),
        geometry: geometry ?? null,
        geometryFadesAt: geometry
          ? Date.now() + (geometryFadeMs ?? DEFAULT_GEOM_FADE_MS)
          : undefined,
        seq: ++highlightSeq,
      },
    }),
  setGeometry: (geometry, opts) => {
    const cur = get().selected;
    if (!cur) return;
    set({
      selected: {
        ...cur,
        geometry: geometry ?? null,
        geometryFadesAt: geometry
          ? Date.now() + (opts?.geometryFadeMs ?? DEFAULT_GEOM_FADE_MS)
          : undefined,
      },
    });
  },
  clear: () => set({ selected: null }),
}));
