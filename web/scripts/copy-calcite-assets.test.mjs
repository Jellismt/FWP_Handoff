/**
 * @file copy-calcite-assets.test.mjs
 * @module engage-mt/scripts
 * @description Unit coverage for the Calcite asset pruning rules.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { camel, iconFileNames, iconLiteralsIn, planCalciteCopy } from "./copy-calcite-assets.mjs";

describe("copy-calcite-assets", () => {
  it("maps kebab-case icon names to Calcite's camelCase asset names", () => {
    expect(camel("exclamation-mark-triangle")).toBe("exclamationMarkTriangle");
    expect(camel("x")).toBe("x");
    expect(iconFileNames("map-pin")).toEqual([
      "mapPin16.json",
      "mapPin16F.json",
      "mapPin24.json",
      "mapPin24F.json",
      "mapPin32.json",
      "mapPin32F.json",
    ]);
  });

  it("keeps allow-listed icons in every variant, drops the rest, and prunes non-English messages", () => {
    const sourceFiles = [
      "icon/information16.json",
      "icon/information16F.json",
      "icon/information24.json",
      "icon/banana16.json",
      "notice/t9n/messages.json",
      "notice/t9n/messages.en.json",
      "notice/t9n/messages.fr.json",
      "notice/t9n/messages.en-gb.json",
      "loader/loader.css",
    ];
    const { keep, missingIcons } = planCalciteCopy({
      allowlist: { icons: ["information"], t9nLocales: ["en"] },
      sourceFiles,
    });
    expect(keep).toEqual([
      "icon/information16.json",
      "icon/information16F.json",
      "icon/information24.json",
      "notice/t9n/messages.json",
      "notice/t9n/messages.en.json",
      "loader/loader.css",
    ]);
    expect(missingIcons).toEqual([]);
  });

  it("reports an allow-listed icon that has no asset file", () => {
    const { missingIcons } = planCalciteCopy({
      allowlist: { icons: ["information", "does-not-exist"], t9nLocales: ["en"] },
      sourceFiles: ["icon/information16.json"],
    });
    expect(missingIcons).toEqual(["does-not-exist"]);
  });

  it("finds icon literals in both JSX forms and ignores expressions", () => {
    const src = `
      <CalciteNotice icon="map-pin" />
      <CalciteNotice icon={"id-card" as never} />
      <CalciteNotice icon={dynamicIcon} />
    `;
    expect([...iconLiteralsIn(src)].sort()).toEqual(["id-card", "map-pin"]);
  });
});
