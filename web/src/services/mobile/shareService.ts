/**
 * @file shareService.ts
 * @module engage-mt/services/mobile
 * @description Platform-adaptive share for waypoints + tracks.
 *              On Capacitor uses the native share sheet (`@capacitor/
 *              share`) which surfaces iMessage / Mail / WhatsApp /
 *              AirDrop / Gmail / etc. On the web tries the Web Share
 *              API first (modern Chrome/Safari/Edge surface a native
 *              share sheet), then falls back to a `mailto:` link,
 *              and finally to clipboard copy.
 *
 *              Privacy: the share payload is composed client-side —
 *              we never call a remote share service. Lat/lon goes
 *              into the message body verbatim. The user controls
 *              where it goes by picking the destination app.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-14
 * @version 1.1.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createLogger } from "@/utils/logger";
import { isCapacitor } from "@/utils/capacitor";
import {
  buildShareBundle,
  countBundleItems,
  isLinkSafe,
  type ShareSelection,
} from "@/services/field/pinShareCodec";
import { buildShareLink } from "@/services/field/shareLink";
import { buildGpxBundle } from "@/services/field/gpxExport";
import { impact } from "@/services/mobile/haptics";

const log = createLogger("share");

export interface SharePayload {
  /** Short title — appears as the subject on Mail / Gmail. */
  title: string;
  /** Body text. May include newlines + URLs; share targets render verbatim. */
  text: string;
  /** Optional URL to attach. Falls into the body if the target doesn't split. */
  url?: string;
  /** Optional `mailto:` recipient — only used by the email fallback. */
  emailFallbackTo?: string;
}

export type ShareOutcome =
  | "shared" // user completed the share
  | "cancelled" // user cancelled the share sheet
  | "copied" // fell back to clipboard
  | "mailto-opened" // fell back to mailto link
  | "failed"; // nothing worked

const escapeMailto = (s: string): string => encodeURIComponent(s).replace(/'/g, "%27");

/** Exported so the SendToPhoneDialog can build an "email it to me"
 *  link with a user-supplied recipient. */
const buildMailtoUrl = (p: SharePayload): string => {
  const body = p.url ? `${p.text}\n\n${p.url}` : p.text;
  const subject = `subject=${escapeMailto(p.title)}`;
  const bodyParam = `body=${escapeMailto(body)}`;
  const recipient = p.emailFallbackTo ?? "";
  return `mailto:${recipient}?${subject}&${bodyParam}`;
};

/**
 * Open the native / web share sheet. Returns the outcome so the caller
 * can show an appropriate toast ("Shared" / "Copied to clipboard").
 */
export const share = async (payload: SharePayload): Promise<ShareOutcome> => {
  // A light haptic as the share sheet opens (native only; no-op on web).
  void impact("light");
  // 1. Capacitor native share sheet — best UX on mobile.
  if (isCapacitor()) {
    try {
      const { Share } = await import("@capacitor/share");
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
          dialogTitle: payload.title,
        });
        return "shared";
      }
    } catch (err) {
      // Treat user cancel as a non-error outcome.
      if (err instanceof Error && /(cancel|abort|dismiss)/i.test(err.message)) {
        return "cancelled";
      }
      log.warn("Capacitor share failed; falling back to Web Share API", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2. Web Share API — modern Chrome / Safari / Edge. Mobile browsers
  //    pop the platform share sheet; desktop opens a simpler picker.
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return "cancelled";
      }
      log.warn("navigator.share failed; trying mailto / clipboard", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3. mailto: fallback — opens the user's default mail client.
  if (typeof window !== "undefined") {
    try {
      window.location.href = buildMailtoUrl(payload);
      return "mailto-opened";
    } catch {
      /* fall through to clipboard */
    }
  }

  // 4. Clipboard copy — last resort. Plain text only.
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      const body = payload.url
        ? `${payload.title}\n\n${payload.text}\n\n${payload.url}`
        : `${payload.title}\n\n${payload.text}`;
      await navigator.clipboard.writeText(body);
      return "copied";
    } catch (err) {
      log.warn("Clipboard write failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return "failed";
};

/**
 * Build the dual-payload "share a pin" message that another Engage MT
 * user can open with full fidelity. The high-fidelity Engage MT link goes in
 * `url` (renders as a tappable preview in iMessage / Mail and deep-links the
 * app straight into the receive sheet). A standard GPX block rides in the body
 * so a recipient WITHOUT the app — or one using another mapping app — still
 * gets the waypoints + tracks. Oversize selections (a whole trip) exceed the
 * link budget; we drop the link and lean on the GPX body so the share still
 * goes through. Shapes + trip grouping ride only in the link (no GPX analog).
 *
 * Privacy: the bundle is composed client-side and strips photo bytes; it only
 * travels inside the message the user explicitly sends. Per
 * docs/rules/privacy.md.
 */
export const buildPinSharePayload = (selection: ShareSelection): SharePayload => {
  const bundle = buildShareBundle(selection);
  const link = isLinkSafe(bundle) ? buildShareLink(bundle).universalLink : null;
  const waypoints = selection.waypoints ?? [];
  const routes = selection.routes ?? [];
  const itemCount = countBundleItems(bundle);

  const onlyWp = waypoints.length === 1 && routes.length === 0 && !(selection.shapes?.length ?? 0);
  const title = onlyWp
    ? `Pin · ${waypoints[0].name}`
    : selection.trip
      ? `Trip · ${selection.trip.name}`
      : `Engage MT — ${itemCount} pin${itemCount === 1 ? "" : "s"}`;

  const lines: string[] = [];
  if (onlyWp) {
    const w = waypoints[0];
    lines.push(`${w.name}`, `Lat / Lon: ${w.lat.toFixed(5)}, ${w.lon.toFixed(5)}`);
    if (w.notes) lines.push("", w.notes);
  } else {
    lines.push(`${itemCount} item${itemCount === 1 ? "" : "s"} from Engage MT.`);
  }

  if (!link) {
    lines.push(
      "",
      "This selection is large — open the attached GPX below in Engage MT or any GPX app.",
    );
  }

  // GPX for waypoints + routes (shapes have no GPX analog; the link carries them).
  if (waypoints.length > 0 || routes.length > 0) {
    lines.push("", buildGpxBundle(waypoints, routes));
  }

  lines.push("", "Shared from Engage MT — Montana FWP's official gateway to the outdoors.");

  return {
    title,
    text: lines.join("\n"),
    url: link ?? undefined,
  };
};
