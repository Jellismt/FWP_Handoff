/**
 * @file shareLink.ts
 * @module engage-mt/services/field
 * @description Build + parse the deep / universal links that carry a
 *              high-fidelity pin-share payload between Engage MT users. The
 *              encoded bundle (from `pinShareCodec.ts`) rides in a `?d=` query
 *              param so it survives `deepLinkToPath`'s existing query-preserving
 *              contract end-to-end:
 *
 *                deep:       engagemt://field/receive?d=<payload>
 *                universal:  https://fwp.mt.gov/app/field/receive?d=<payload>
 *
 *              Also detects share links that belong to a *different* app or
 *              origin (any external, non-Engage-MT host) so the app can
 *              "detect & guide" — explain that such links are locked to their
 *              origin app and the sender should export a GPX/KML file instead —
 *              WITHOUT trying to decode a format we don't own.
 *
 *              Privacy: pure string construction; no network. Per
 *              docs/rules/privacy.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-15
 * @version 1.2.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { encodeShareBundle, type EngageMtShareBundle } from "@/services/field/pinShareCodec";

/** In-app route that decodes a `?d=` payload into the receive preview. */
export const RECEIVE_PATH = "/field/receive";

/** Our universal-link host. Any other http(s) host is treated as external. */
const APP_UNIVERSAL_HOST = "fwp.mt.gov";

const DEEP_LINK_BASE = `engagemt:/${RECEIVE_PATH}`; // engagemt://field/receive
const UNIVERSAL_LINK_BASE = `https://${APP_UNIVERSAL_HOST}/app${RECEIVE_PATH}`;

export interface ShareLink {
  /** Encoded `?d=` payload (also returned so the caller can size-check it). */
  encoded: string;
  /** Custom-scheme link — opens the installed app directly on mobile. */
  deepLink: string;
  /** Universal link — opens the app if installed, else the web app. */
  universalLink: string;
  /**
   * A same-origin `/field/receive` link built from the CURRENT web
   * origin, present only when `webOrigin` is supplied. The universal link
   * hardcodes `fwp.mt.gov/app`, which is dead until FWP hosting is live; the
   * web send-to-phone flow uses this instead so the link resolves on whatever
   * origin the user actually loaded (Railway today, fwp.mt.gov later).
   */
  webLink?: string;
}

export interface BuildShareLinkOpts {
  /** e.g. `window.location.origin` — enables the same-origin `webLink`. */
  webOrigin?: string;
}

/** Build the deep + universal (+ optional same-origin web) links for a bundle. */
export const buildShareLink = (
  bundle: EngageMtShareBundle,
  opts: BuildShareLinkOpts = {},
): ShareLink => {
  const encoded = encodeShareBundle(bundle);
  const query = `?d=${encoded}`;
  return {
    encoded,
    deepLink: `${DEEP_LINK_BASE}${query}`,
    universalLink: `${UNIVERSAL_LINK_BASE}${query}`,
    ...(opts.webOrigin
      ? { webLink: `${opts.webOrigin.replace(/\/$/, "")}${RECEIVE_PATH}${query}` }
      : {}),
  };
};

/**
 * Extract the `d` payload from a query string (e.g. `location.search` or the
 * `?…` portion of a deep link). Returns `null` when absent. Pure + testable.
 */
export const parseShareLinkParam = (search: string): string | null => {
  if (!search) return null;
  const qs = search.startsWith("?") ? search.slice(1) : search;
  const value = new URLSearchParams(qs).get("d");
  return value && value.length > 0 ? value : null;
};

/**
 * Detect a share link that belongs to a *different* app or origin — any http(s)
 * URL whose host isn't our own universal-link host. Links like these are locked
 * to their origin app and can't be decoded here, so the caller shows guidance
 * pointing the user at that app's Export → GPX/KML flow instead of dead-ending
 * (or mis-navigating to a bogus in-app path).
 */
export const isExternalShareLink = (url: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  return host !== APP_UNIVERSAL_HOST && !host.endsWith(`.${APP_UNIVERSAL_HOST}`);
};
