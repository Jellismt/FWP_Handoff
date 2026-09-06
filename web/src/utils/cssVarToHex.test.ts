/**
 * @file cssVarToHex.test.ts
 * @module engage-mt/utils
 * @description Coverage for `cssVarToHex.ts`.
 *              Resolves CSS custom property strings against the current
 *              document and validates the SSR-safe fallback path.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-10
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { cssVarToHex } from "./cssVarToHex";

describe("cssVarToHex", () => {
  beforeEach(() => {
    document.body.style.removeProperty("--fwp-test-token");
  });

  it("resolves a defined CSS custom property", () => {
    document.body.style.setProperty("--fwp-test-token", "#abcdef");
    expect(cssVarToHex("var(--fwp-test-token)")).toBe("#abcdef");
  });

  it("returns the safe fallback when the token is missing", () => {
    expect(cssVarToHex("var(--fwp-does-not-exist)")).toBe("#1B3D6B");
  });

  it("passes a plain hex through untouched", () => {
    expect(cssVarToHex("#fff")).toBe("#fff");
    expect(cssVarToHex("#1A2B3C")).toBe("#1A2B3C");
  });

  it("accepts a bare token name (no var() wrapper)", () => {
    document.body.style.setProperty("--fwp-test-token", "rgb(10, 20, 30)");
    expect(cssVarToHex("--fwp-test-token")).toBe("rgb(10, 20, 30)");
  });

  it("trims whitespace returned by getComputedStyle", () => {
    document.body.style.setProperty("--fwp-test-token", "   #112233   ");
    // getComputedStyle in happy-dom returns the literal; the trim()
    // in cssVarToHex collapses the leading/trailing whitespace.
    expect(cssVarToHex("var(--fwp-test-token)")).toBe("#112233");
  });
});
