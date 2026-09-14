/**
 * @file shareService.behavior.test.ts
 * @module engage-mt/services/mobile
 * @description Behavior tests for the `share` dispatch fallback chain and
 *              the `buildPinSharePayload` dual-payload composer (the pure
 *              waypoint/track payload builders are covered in the adjacent
 *              shareService.test.ts). `@capacitor/share`, the Web Share API,
 *              `navigator.clipboard`, `window.location`, and the field codec
 *              are mocked at the seam so we assert the four-tier cascade:
 *              Capacitor native → Web Share → mailto → clipboard, plus the
 *              cancel/abort short-circuits and the "failed" terminal.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isCapacitor: vi.fn(() => false),
  capCanShare: vi.fn(),
  capShare: vi.fn(),
  isLinkSafe: vi.fn(() => true),
  countBundleItems: vi.fn(() => 1),
  buildShareBundle: vi.fn(() => ({ kind: "share", photosOmitted: 0 })),
  buildShareLink: vi.fn(() => ({ universalLink: "https://fwp.mt.gov/app/field/receive?d=ABC" })),
  buildGpxBundle: vi.fn(() => "<gpx>BUNDLE</gpx>"),
}));

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@/utils/capacitor", () => ({
  isCapacitor: h.isCapacitor,
  getPlatform: () => "web",
}));
vi.mock("@/services/mobile/haptics", () => ({ impact: vi.fn(() => Promise.resolve()) }));
vi.mock("@capacitor/share", () => ({
  Share: { canShare: h.capCanShare, share: h.capShare },
}));
vi.mock("@/services/field/pinShareCodec", () => ({
  buildShareBundle: h.buildShareBundle,
  countBundleItems: h.countBundleItems,
  isLinkSafe: h.isLinkSafe,
}));
vi.mock("@/services/field/shareLink", () => ({ buildShareLink: h.buildShareLink }));
vi.mock("@/services/field/gpxExport", () => ({ buildGpxBundle: h.buildGpxBundle }));

import { share, buildPinSharePayload, type SharePayload } from "./shareService";
import type { ShareSelection } from "@/services/field/pinShareCodec";

const PAYLOAD: SharePayload = {
  title: "Waypoint · Test",
  text: "body line",
  url: "https://maps.apple.com/?ll=46,-111",
};

// ── navigator / window seam management ───────────────────────────────────
type NavShare = ((data: ShareData) => Promise<void>) | undefined;
const setNavigatorShare = (fn: NavShare): void => {
  Object.defineProperty(navigator, "share", { value: fn, configurable: true, writable: true });
};
const setClipboard = (fn: ((t: string) => Promise<void>) | undefined): void => {
  Object.defineProperty(navigator, "clipboard", {
    value: fn ? { writeText: fn } : undefined,
    configurable: true,
    writable: true,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  h.isCapacitor.mockReturnValue(false);
  setNavigatorShare(undefined);
  setClipboard(undefined);
});

afterEach(() => {
  setNavigatorShare(undefined);
  setClipboard(undefined);
});

describe("share — Capacitor native tier", () => {
  it("uses the native share sheet and returns 'shared' when canShare is true", async () => {
    h.isCapacitor.mockReturnValue(true);
    h.capCanShare.mockResolvedValue({ value: true });
    h.capShare.mockResolvedValue(undefined);
    await expect(share(PAYLOAD)).resolves.toBe("shared");
    expect(h.capShare).toHaveBeenCalledWith(
      expect.objectContaining({ title: PAYLOAD.title, text: PAYLOAD.text, url: PAYLOAD.url }),
    );
  });

  it("treats a native cancel as 'cancelled' (no further fallback)", async () => {
    h.isCapacitor.mockReturnValue(true);
    h.capCanShare.mockResolvedValue({ value: true });
    h.capShare.mockRejectedValue(new Error("Share canceled by user"));
    // Web Share is present but must NOT be reached after a cancel.
    const navShare = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(navShare);
    await expect(share(PAYLOAD)).resolves.toBe("cancelled");
    expect(navShare).not.toHaveBeenCalled();
  });

  it("falls through to the next tier when canShare reports false", async () => {
    h.isCapacitor.mockReturnValue(true);
    h.capCanShare.mockResolvedValue({ value: false });
    const navShare = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(navShare);
    await expect(share(PAYLOAD)).resolves.toBe("shared");
    expect(navShare).toHaveBeenCalledTimes(1);
    expect(h.capShare).not.toHaveBeenCalled();
  });

  it("falls through to Web Share when the native plugin throws a non-cancel error", async () => {
    h.isCapacitor.mockReturnValue(true);
    h.capCanShare.mockRejectedValue(new Error("plugin not implemented"));
    const navShare = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(navShare);
    await expect(share(PAYLOAD)).resolves.toBe("shared");
    expect(navShare).toHaveBeenCalled();
  });
});

describe("share — Web Share API tier", () => {
  it("returns 'shared' when navigator.share resolves", async () => {
    const navShare = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(navShare);
    await expect(share(PAYLOAD)).resolves.toBe("shared");
    expect(navShare).toHaveBeenCalledWith({
      title: PAYLOAD.title,
      text: PAYLOAD.text,
      url: PAYLOAD.url,
    });
  });

  it("returns 'cancelled' on an AbortError without falling to mailto", async () => {
    const abort = new Error("user aborted");
    abort.name = "AbortError";
    const navShare = vi.fn().mockRejectedValue(abort);
    setNavigatorShare(navShare);
    // Provide a clipboard so we'd know if it wrongly fell through.
    const clip = vi.fn().mockResolvedValue(undefined);
    setClipboard(clip);
    await expect(share(PAYLOAD)).resolves.toBe("cancelled");
    expect(clip).not.toHaveBeenCalled();
  });

  it("falls through to mailto when navigator.share throws a non-abort error", async () => {
    const navShare = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    setNavigatorShare(navShare);
    const originalHref = window.location.href;
    let assigned = "";
    Object.defineProperty(window, "location", {
      value: {
        get href() {
          return originalHref;
        },
        set href(v: string) {
          assigned = v;
        },
      },
      configurable: true,
      writable: true,
    });
    await expect(share(PAYLOAD)).resolves.toBe("mailto-opened");
    expect(assigned.startsWith("mailto:")).toBe(true);
  });
});

describe("share — mailto tier", () => {
  it("opens a mailto: url with encoded subject + body + recipient", async () => {
    let assigned = "";
    Object.defineProperty(window, "location", {
      value: {
        set href(v: string) {
          assigned = v;
        },
        get href() {
          return "";
        },
      },
      configurable: true,
      writable: true,
    });
    await expect(
      share({ title: "T&T", text: "hi there", url: "u", emailFallbackTo: "a@b.co" }),
    ).resolves.toBe("mailto-opened");
    expect(assigned).toContain("mailto:a@b.co?");
    expect(assigned).toContain("subject=");
    expect(assigned).toContain("body=");
    // Body concatenates url below the text.
    expect(assigned).toContain(encodeURIComponent("hi there"));
  });
});

describe("share — clipboard tier + terminal failure", () => {
  it("copies to the clipboard and returns 'copied' when mailto throws", async () => {
    // Make the mailto assignment throw so control reaches the clipboard tier.
    Object.defineProperty(window, "location", {
      value: {
        set href(_v: string) {
          throw new Error("navigation blocked");
        },
        get href() {
          return "";
        },
      },
      configurable: true,
      writable: true,
    });
    const clip = vi.fn().mockResolvedValue(undefined);
    setClipboard(clip);
    await expect(share(PAYLOAD)).resolves.toBe("copied");
    const body = clip.mock.calls[0][0] as string;
    expect(body).toContain(PAYLOAD.title);
    expect(body).toContain(PAYLOAD.text);
    expect(body).toContain(PAYLOAD.url as string);
  });

  it("returns 'failed' when every tier is unavailable", async () => {
    // No Capacitor, no navigator.share, mailto throws, no clipboard.
    Object.defineProperty(window, "location", {
      value: {
        set href(_v: string) {
          throw new Error("blocked");
        },
        get href() {
          return "";
        },
      },
      configurable: true,
      writable: true,
    });
    setClipboard(undefined);
    await expect(share(PAYLOAD)).resolves.toBe("failed");
  });
});

describe("buildPinSharePayload", () => {
  const wp = (name: string): ShareSelection["waypoints"] extends readonly (infer T)[] ? T : never =>
    ({
      id: name,
      name,
      lat: 46.12345,
      lon: -111.54321,
      kind: "general",
    }) as never;

  it("titles a single-waypoint share 'Pin · {name}' and attaches the link + GPX", () => {
    h.isLinkSafe.mockReturnValue(true);
    const p = buildPinSharePayload({ waypoints: [wp("Lone Pine")] });
    expect(p.title).toBe("Pin · Lone Pine");
    expect(p.text).toContain("Lone Pine");
    expect(p.text).toContain("46.12345, -111.54321");
    expect(p.text).toContain("<gpx>BUNDLE</gpx>"); // GPX body present
    expect(p.url).toBe("https://fwp.mt.gov/app/field/receive?d=ABC");
  });

  it("uses the trip title and item count for a multi-item trip share", () => {
    h.countBundleItems.mockReturnValue(3);
    const p = buildPinSharePayload({
      waypoints: [wp("A"), wp("B")],
      trip: { id: "t1", name: "Fall Elk Camp" } as never,
    });
    expect(p.title).toBe("Trip · Fall Elk Camp");
    expect(p.text).toContain("3 items from Engage MT.");
  });

  it("drops the link and leans on GPX when the selection is too large to encode", () => {
    h.isLinkSafe.mockReturnValue(false);
    h.countBundleItems.mockReturnValue(50);
    const p = buildPinSharePayload({ waypoints: [wp("A"), wp("B")] });
    expect(p.url).toBeUndefined();
    expect(p.text).toContain("This selection is large");
    expect(p.text).toContain("<gpx>BUNDLE</gpx>");
  });

  it("falls back to the generic pin-count title when there is no trip and >1 item", () => {
    h.isLinkSafe.mockReturnValue(true);
    h.countBundleItems.mockReturnValue(2);
    const p = buildPinSharePayload({ waypoints: [wp("A"), wp("B")] });
    expect(p.title).toBe("Engage MT — 2 pins");
  });
});
