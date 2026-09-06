/**
 * @file api.test.ts
 * @module engage-mt/staff
 * @description Contract tests for the staff API client's request wrapper:
 *              envelope unwrapping, typed errors, and the 304 short-circuit.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-05
 * @updated 2026-09-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api.js";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("staff api request wrapper", () => {
  it("unwraps the data envelope and sends same-origin JSON requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [{ season_year: 2026 }], meta: null, errors: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const rows = await api.seasonYears();
    expect(rows).toEqual([{ season_year: 2026 }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/staff/season-years");
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("throws a typed ApiError carrying the envelope's first error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(json({ data: null, meta: null, errors: [{ code: "UNAUTHORIZED", message: "Sign in." }] }, 401))),
    );
    await expect(api.me()).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED", message: "Sign in." });
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
  });

  it("treats 304 Not Modified as an empty result without parsing a body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 304 })));
    expect(await api.seasonYears()).toEqual([]);
  });
});
