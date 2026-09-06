/**
 * @file toolIntroStore.ts
 * @module engage-mt/store
 * @description Remembers which map-first tool intros the
 *              user has dismissed with "Don't show again", so the closeable
 *              ToolIntroExplainer popup doesn't nag on every visit. Persisted
 *              cross-platform via `platformStorage` (localStorage on web,
 *              @capacitor/preferences on mobile — never raw web localStorage on
 *              device, which doesn't reliably persist there).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-06
 * @updated 2026-07-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { platformStorage } from "@/store/capacitorPreferencesStorage";

interface ToolIntroState {
  /** toolId → true once the user chose "Don't show again". */
  dismissed: Record<string, boolean>;
  /** Has this tool's intro been permanently dismissed? */
  isDismissed: (toolId: string) => boolean;
  /** Permanently dismiss a tool's intro (survives sessions). */
  dismiss: (toolId: string) => void;
}

export const useToolIntroStore = create<ToolIntroState>()(
  persist(
    (set, get) => ({
      dismissed: {},
      isDismissed: (toolId) => get().dismissed[toolId] === true,
      dismiss: (toolId) => set((state) => ({ dismissed: { ...state.dismissed, [toolId]: true } })),
    }),
    {
      name: "engage-mt:tool-intros",
      storage: createJSONStorage(platformStorage),
      partialize: (state) => ({ dismissed: state.dismissed }),
    },
  ),
);
