/**
 * @file userGraphicsVisibleStore.ts
 * @module engage-mt/store
 * @description Toggle for the "Hide my pins" map control. The
 *              field-tools GraphicsLayer always exists (user-owned content
 *              must never disappear silently) but the user can hide its
 *              graphics layer when their pins crowd the operational
 *              overlay they're trying to inspect.
 *
 *              State persists locally per [docs/rules/privacy.md]
 *              (../../../docs/rules/privacy.md) — the visibility flag
 *              is a UI preference, not behavioral telemetry.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import { createPersistedBool } from "@/store/persistedKey";

const PERSIST_KEY = "engage-mt:user-graphics-visible";
const persisted = createPersistedBool(PERSIST_KEY);

interface UserGraphicsVisibleState {
  visible: boolean;
  toggle: () => void;
  setVisible: (value: boolean) => void;
}

export const useUserGraphicsVisibleStore = create<UserGraphicsVisibleState>((set, get) => ({
  visible: persisted.read(true),
  toggle: () => {
    const next = !get().visible;
    persisted.write(next);
    set({ visible: next });
  },
  setVisible: (value) => {
    persisted.write(value);
    set({ visible: value });
  },
}));
