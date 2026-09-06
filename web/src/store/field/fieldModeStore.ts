/**
 * @file fieldModeStore.ts
 * @module engage-mt/store
 * @description Field-mode toggle. When on, the UI elevates locate-me,
 *              surfaces offline indicators, and dims chrome that
 *              doesn't help in the field. Persisted to localStorage
 *              per `docs/rules/privacy.md` (state stays on this
 *              device).
 *
 *              Now uses the shared `persistedKey` helper.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import { createPersistedBool } from "@/store/persistedKey";

const slot = createPersistedBool("engage-mt:field-mode");

interface FieldModeState {
  active: boolean;
  toggle: () => void;
  set: (next: boolean) => void;
}

export const useFieldModeStore = create<FieldModeState>((set, get) => ({
  active: slot.read(false),
  toggle: () => {
    const next = !get().active;
    slot.write(next);
    set({ active: next });
  },
  set: (next) => {
    slot.write(next);
    set({ active: next });
  },
}));
