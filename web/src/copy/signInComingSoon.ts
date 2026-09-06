/**
 * @file signInComingSoon.ts
 * @module engage-mt/copy
 * @description Shared toast payload for the "Log in to My FWP" affordance, which
 *              is an intentional seam (STUB-001) until the real FWP OAuth is
 *              wired. The header popover and the My FWP page both surface the
 *              same button; on click they show this coming-soon toast so the CTA
 *              gives clear feedback instead of doing nothing. FWP voice per
 *              docs/rules/notifications.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-21
 * @updated 2026-07-21
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** Toast shown when a user taps the (not-yet-wired) "Log in to My FWP" button. */
export const SIGN_IN_COMING_SOON = {
  kind: "info" as const,
  title: "My FWP sign-in is coming soon",
  message:
    "Signing in to see your licenses and tags isn't available yet — it's on the way in a future release.",
};
