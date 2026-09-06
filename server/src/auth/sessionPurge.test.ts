/**
 * @file sessionPurge.test.ts
 * @module engage-mt/server/auth
 * @description The purge runs on ready, repeats on its interval, survives a
 *              failing sweep, and stops on close. No database.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ purge: vi.fn() }));
vi.mock("./sessions.js", () => ({ purgeExpiredSessions: h.purge }));

import { sessionPurge } from "./sessionPurge.js";

beforeEach(() => {
  vi.useFakeTimers();
  h.purge.mockReset().mockResolvedValue(0);
});
afterEach(() => vi.useRealTimers());

describe("sessionPurge", () => {
  it("sweeps on ready, again on each interval, and not after close", async () => {
    const app = Fastify({ logger: false });
    await app.register(sessionPurge, { intervalMs: 1000 });
    await app.ready();
    expect(h.purge).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.purge).toHaveBeenCalledTimes(3);
    await app.close();
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.purge).toHaveBeenCalledTimes(3);
  });

  it("logs and keeps ticking when a sweep throws", async () => {
    h.purge.mockRejectedValueOnce(new Error("db down")).mockResolvedValue(2);
    const app = Fastify({ logger: false });
    const warn = vi.spyOn(app.log, "warn");
    await app.register(sessionPurge, { intervalMs: 500 });
    await app.ready();
    expect(warn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(h.purge).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
