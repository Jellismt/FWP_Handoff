/**
 * @file errors.ts
 * @module engage-mt/copy
 * @description User-facing error copy in one place. Every
 *              data-fetch surface in the app says some variant of
 *              "We couldn't load X" when the network hiccups, but the
 *              wording drifted across files. This module centralizes
 *              the canonical strings so the FWP voice review only has
 *              to read them once.
 *
 *              FWP voice rules apply (per `docs/rules/notifications.md`
 *              § "Voice"):
 *                - Authoritative + accessible. Plain English.
 *                - No blame. The user didn't cause the failure.
 *                - Single clear next step. "Try again" is the default.
 *
 *              Function form (`fetchError(subject)`) over flat strings
 *              so callers can localize / brand once we hit i18n in
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/**
 * Build a per-subject fetch-error message. Pass the kind of thing the
 * page was loading (`"trails"`, `"districts"`, …); the helper returns a
 * tidy headline + body pair the `<FetchErrorCard>` primitive consumes.
 */
export const fetchError = (subject: string): { title: string; body: string } => ({
  title: `We couldn't load the ${subject}`,
  body: `Check your connection and try again. If this persists, the upstream data source may be temporarily down.`,
});
