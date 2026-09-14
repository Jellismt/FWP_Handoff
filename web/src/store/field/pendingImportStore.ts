/**
 * @file pendingImportStore.ts
 * @module engage-mt/store
 * @description Tier-3 hand-off channel for a GPX/KML file opened from
 *              OUTSIDE the app (OS share sheet / Files app). The native
 *              app-lifecycle reads + parses the file, drops the result here, and
 *              navigates to Field Tools, which picks it up and opens the import
 *              preview. Local-only; never persisted.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import type { GpxImportResult } from "@/services/field/gpxImport";

interface PendingImportState {
  /** Parsed result awaiting a preview + commit, or null when none pending. */
  result: GpxImportResult | null;
  /** Human label for the source (filename) shown in the preview. */
  sourceLabel: string | null;
  setResult: (result: GpxImportResult, sourceLabel?: string) => void;
  clear: () => void;
}

export const usePendingImportStore = create<PendingImportState>((set) => ({
  result: null,
  sourceLabel: null,
  setResult: (result, sourceLabel) => set({ result, sourceLabel: sourceLabel ?? null }),
  clear: () => set({ result: null, sourceLabel: null }),
}));
