/**
 * @file haptics.ts
 * @module engage-mt/services/mobile
 * @description Cross-platform haptic feedback wrapper. On Capacitor uses
 *              @capacitor/haptics; on web falls back to navigator.vibrate where
 *              available (Android Chrome / iOS Safari). Silently no-ops if
 *              neither is reachable.
 *
 *              Privacy: invoking a haptic emits no network traffic and reveals
 *              no device identifier. Safe to call from anywhere.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createLogger } from "@/utils/logger";
import { isCapacitor } from "@/utils/capacitor";

const log = createLogger("haptics");

export type HapticIntensity = "light" | "medium" | "heavy";

/**
 * Fire a single haptic impact at the requested intensity.
 * No-ops on hardware without haptics (desktop browsers).
 */
export const impact = async (intensity: HapticIntensity = "medium"): Promise<void> => {
  if (isCapacitor()) {
    try {
      const mod = await import("@capacitor/haptics");
      const style =
        intensity === "heavy"
          ? mod.ImpactStyle.Heavy
          : intensity === "light"
            ? mod.ImpactStyle.Light
            : mod.ImpactStyle.Medium;
      await mod.Haptics.impact({ style });
      return;
    } catch (err) {
      log.warn("capacitor haptics failed; falling back to navigator.vibrate", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    const duration = intensity === "heavy" ? 80 : intensity === "light" ? 20 : 40;
    navigator.vibrate(duration);
  }
};
