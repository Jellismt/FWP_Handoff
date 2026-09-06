/**
 * @file useToast.ts
 * @module engage-mt/hooks
 * @description Component-facing toast emitter. Returns show/dismiss bound to the global queue.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useToastStore } from "@/store/app/toastStore";

export const useToast = () => ({
  show: useToastStore((s) => s.show),
  dismiss: useToastStore((s) => s.dismiss),
});
