/**
 * @file capacitor.config.test.ts
 * @module engage-mt/mobile
 * @description Contract tests for the Capacitor configuration: the values the
 *              native shells depend on and that store review checks.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-05
 * @updated 2026-09-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import config from "./capacitor.config";

const FWP_BLUE = "#002855";

describe("capacitor.config", () => {
  it("identifies the app with the FWP bundle id and name", () => {
    expect(config.appId).toBe("gov.mt.fwp.engagemt");
    expect(config.appName).toBe("Engage MT");
  });

  it("wraps the sibling web build", () => {
    expect(config.webDir).toBe("../web/dist");
    expect(existsSync(resolve(__dirname, "../web/package.json"))).toBe(true);
  });

  it("keeps the full-bleed iOS inset mode the safe-area CSS depends on", () => {
    expect(config.ios?.contentInset).toBe("never");
  });

  it("blocks mixed content on Android", () => {
    expect(config.android?.allowMixedContent).toBe(false);
  });

  it("paints the splash and status bar in FWP Blue", () => {
    expect(config.plugins?.SplashScreen?.backgroundColor).toBe(FWP_BLUE);
    expect(config.plugins?.StatusBar?.backgroundColor).toBe(FWP_BLUE);
    expect(config.plugins?.SplashScreen?.showSpinner).toBe(false);
  });
});
