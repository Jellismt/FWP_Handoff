/**
 * @file errors.test.ts
 * @module engage-mt/utils
 * @description Unit tests for typed error classes.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-04
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { EngageMtError, NetworkError, AuthError, RateLimitError, isEngageMtError } from "./errors";

describe("typed errors", () => {
  it("preserves message and instanceof chain", () => {
    const e = new NetworkError("oops");
    expect(e.message).toBe("oops");
    expect(e instanceof NetworkError).toBe(true);
    expect(e instanceof EngageMtError).toBe(true);
    expect(e instanceof Error).toBe(true);
  });

  it("carries retryAfter on RateLimitError", () => {
    const e = new RateLimitError("slow down", 30);
    expect(e.retryAfterSeconds).toBe(30);
  });

  it("isEngageMtError narrows correctly", () => {
    const a: unknown = new AuthError("nope");
    const b: unknown = new Error("nope");
    expect(isEngageMtError(a)).toBe(true);
    expect(isEngageMtError(b)).toBe(false);
  });
});
