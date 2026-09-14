/**
 * @file appLifecycle.test.ts
 * @module engage-mt/services/mobile
 * @description Verifies the pure decision helpers behind the native app-
 *              lifecycle wiring (Android Back routing + deep-link parsing) so
 *              the branch logic is covered without a device.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-14
 * @version 1.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { resolveBackAction, deepLinkToPath, classifyLaunchUrl, ROOT_PATHS } from "./appLifecycle";

describe("resolveBackAction", () => {
  it("exits from every tab-root route regardless of history", () => {
    for (const root of ROOT_PATHS) {
      expect(resolveBackAction(root, true)).toBe("exit");
      expect(resolveBackAction(root, false)).toBe("exit");
    }
  });

  it("walks back from a deep screen when history exists", () => {
    expect(resolveBackAction("/hunt/districts", true)).toBe("back");
    expect(resolveBackAction("/hunt/district/380", true)).toBe("back");
  });

  it("exits from a deep screen reached directly (no history — e.g. deep link)", () => {
    expect(resolveBackAction("/hunt/districts", false)).toBe("exit");
  });
});

describe("deepLinkToPath", () => {
  it("maps a custom-scheme URL to a router path", () => {
    expect(deepLinkToPath("engagemt://hunt/districts")).toBe("/hunt/districts");
  });

  it("maps a bare custom-scheme host to a single-segment path", () => {
    expect(deepLinkToPath("engagemt://fish")).toBe("/fish");
  });

  it("maps an empty custom-scheme URL to root", () => {
    expect(deepLinkToPath("engagemt://")).toBe("/");
  });

  it("preserves a query string on a custom-scheme deep link", () => {
    expect(deepLinkToPath("engagemt://hunt/districts")).toBe("/hunt/districts");
  });

  it("strips an optional /app base from a universal link", () => {
    expect(deepLinkToPath("https://fwp.mt.gov/app/access/bma")).toBe("/access/bma");
  });

  it("maps a universal link with no /app base to its pathname", () => {
    expect(deepLinkToPath("https://fwp.mt.gov/explore")).toBe("/explore");
  });

  it("maps a bare universal-link host to root", () => {
    expect(deepLinkToPath("https://fwp.mt.gov/app")).toBe("/");
  });

  it("returns null for an unrelated scheme", () => {
    expect(deepLinkToPath("mailto:someone@example.com")).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(deepLinkToPath("not a url")).toBeNull();
  });
});

describe("classifyLaunchUrl", () => {
  it("classifies file:// and content:// opens as a shared file", () => {
    expect(classifyLaunchUrl("file:///var/mobile/tmp/pin.gpx")).toBe("share-file");
    expect(classifyLaunchUrl("content://com.android.providers/document/123")).toBe("share-file");
  });

  it("classifies an external link as guidance (not a decodable link)", () => {
    expect(classifyLaunchUrl("https://share.example.com/waypoint/abc")).toBe("external-guidance");
  });

  it("classifies our own deep + universal links as deep-link", () => {
    expect(classifyLaunchUrl("engagemt://field/receive?d=abc")).toBe("deep-link");
    expect(classifyLaunchUrl("https://fwp.mt.gov/app/field/receive?d=abc")).toBe("deep-link");
  });

  it("classifies an unrelated URL as unknown", () => {
    expect(classifyLaunchUrl("mailto:someone@example.com")).toBe("unknown");
  });
});
