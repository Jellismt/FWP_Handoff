/**
 * @file shareLink.test.ts
 * @module engage-mt/services/field
 * @description Build/parse symmetry for pin-share links, the
 *              deepLinkToPath interop (the `?d=` payload survives routing), and
 *              external-link host detection for the detect-and-guide path.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-14
 * @version 1.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { deepLinkToPath } from "@/services/mobile/appLifecycle";
import { buildShareBundle, decodeShareBundle } from "./pinShareCodec";
import type { Waypoint } from "@/store/field/fieldToolsStore";
import {
  buildShareLink,
  isExternalShareLink,
  parseShareLinkParam,
  RECEIVE_PATH,
} from "./shareLink";

const wp: Waypoint = {
  id: "wp-1",
  kind: "camp",
  name: "Base camp",
  lat: 46.1,
  lon: -111.5,
  createdAt: "2026-06-30T13:00:00.000Z",
  updatedAt: "2026-06-30T13:00:00.000Z",
  photos: [],
  tags: [],
};

describe("buildShareLink", () => {
  it("produces deep + universal links carrying the same payload", () => {
    const { deepLink, universalLink, encoded } = buildShareLink(
      buildShareBundle({ waypoints: [wp] }),
    );
    expect(deepLink).toBe(`engagemt://field/receive?d=${encoded}`);
    expect(universalLink).toBe(`https://fwp.mt.gov/app/field/receive?d=${encoded}`);
  });

  it("omits webLink by default and emits a same-origin one when webOrigin is passed", () => {
    const bundle = buildShareBundle({ waypoints: [wp] });
    expect(buildShareLink(bundle).webLink).toBeUndefined();
    const { webLink, encoded } = buildShareLink(bundle, {
      webOrigin: "https://engage-mt.example/",
    });
    // Trailing slash on the origin is normalized; payload matches.
    expect(webLink).toBe(`https://engage-mt.example/field/receive?d=${encoded}`);
  });

  it("round-trips through parseShareLinkParam from both link shapes", () => {
    const link = buildShareLink(buildShareBundle({ waypoints: [wp] }));
    for (const url of [link.deepLink, link.universalLink]) {
      const search = url.slice(url.indexOf("?"));
      const payload = parseShareLinkParam(search);
      expect(payload).toBe(link.encoded);
      expect(decodeShareBundle(payload!).waypoints?.[0].name).toBe("Base camp");
    }
  });

  it("survives deepLinkToPath routing with the payload intact", () => {
    const link = buildShareLink(buildShareBundle({ waypoints: [wp] }));
    const routed = deepLinkToPath(link.deepLink);
    expect(routed?.startsWith(`${RECEIVE_PATH}?d=`)).toBe(true);
    const payload = parseShareLinkParam(routed!.slice(routed!.indexOf("?")));
    expect(decodeShareBundle(payload!).waypoints?.[0].id).toBe("wp-1");
  });
});

describe("parseShareLinkParam", () => {
  it("returns null when there is no d param", () => {
    expect(parseShareLinkParam("")).toBeNull();
    expect(parseShareLinkParam("?foo=bar")).toBeNull();
  });

  it("tolerates a leading ? or none", () => {
    expect(parseShareLinkParam("?d=abc")).toBe("abc");
    expect(parseShareLinkParam("d=abc")).toBe("abc");
  });
});

describe("isExternalShareLink", () => {
  it("detects external (non-fwp.mt.gov) http(s) hosts", () => {
    expect(isExternalShareLink("https://share.example.com/some/pin")).toBe(true);
    expect(isExternalShareLink("https://another-app.example/pin/123")).toBe(true);
  });

  it("ignores our own + non-http links", () => {
    expect(isExternalShareLink("https://fwp.mt.gov/app/field/receive?d=abc")).toBe(false);
    expect(isExternalShareLink("engagemt://field/receive?d=abc")).toBe(false);
    expect(isExternalShareLink("not a url")).toBe(false);
  });
});
