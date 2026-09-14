/**
 * @file ipAllowlist.test.ts
 * @module engage-mt/server/security
 * @description Exact and CIDR matching for both IP families, mapped-IPv6
 *              normalization, and malformed-entry rejection.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { normalizeIp, parseIpAllowlist, registerStaffIpAllowlist } from "./ipAllowlist.js";

describe("parseIpAllowlist", () => {
  it("is disabled when nothing is configured", () => {
    const list = parseIpAllowlist([]);
    expect(list.enabled).toBe(false);
    expect(list.size).toBe(0);
  });

  it("matches exact IPv4 and IPv6 addresses", () => {
    const list = parseIpAllowlist(["203.0.113.9", "2001:db8::1"]);
    expect(list.allows("203.0.113.9")).toBe(true);
    expect(list.allows("203.0.113.10")).toBe(false);
    expect(list.allows("2001:db8::1")).toBe(true);
    expect(list.allows("2001:db8::2")).toBe(false);
  });

  it("matches CIDR ranges in both families", () => {
    const list = parseIpAllowlist(["10.0.0.0/8", "203.0.113.0/24", "2001:db8::/32"]);
    expect(list.allows("10.255.255.255")).toBe(true);
    expect(list.allows("11.0.0.1")).toBe(false);
    expect(list.allows("203.0.113.200")).toBe(true);
    expect(list.allows("203.0.114.1")).toBe(false);
    expect(list.allows("2001:db8:ffff::9")).toBe(true);
    expect(list.allows("2001:db9::1")).toBe(false);
  });

  it("normalizes IPv4-mapped IPv6 candidates and entries", () => {
    expect(normalizeIp("::ffff:203.0.113.9")).toBe("203.0.113.9");
    const list = parseIpAllowlist(["::ffff:203.0.113.0/24"]);
    expect(list.allows("::ffff:203.0.113.7")).toBe(true);
    expect(list.allows("203.0.113.7")).toBe(true);
  });

  it("rejects malformed entries and prefixes", () => {
    expect(() => parseIpAllowlist(["not-an-ip"])).toThrow(/invalid entry/);
    expect(() => parseIpAllowlist(["203.0.113.0/33"])).toThrow(/invalid CIDR prefix/);
    expect(() => parseIpAllowlist(["2001:db8::/129"])).toThrow(/invalid CIDR prefix/);
    expect(() => parseIpAllowlist(["10.0.0.0/8/extra"])).toThrow(/invalid entry/);
  });

  it("never allows a candidate that is not an IP address", () => {
    expect(parseIpAllowlist(["10.0.0.0/8"]).allows("localhost")).toBe(false);
  });
});

describe("registerStaffIpAllowlist", () => {
  const build = async (entries: string[]) => {
    const app = Fastify({ logger: false, trustProxy: true });
    registerStaffIpAllowlist(app, parseIpAllowlist(entries));
    app.get("/api/v1/staff/ping", async () => ({ ok: true }));
    app.get("/api/v1/healthz", async () => ({ ok: true }));
    await app.ready();
    return app;
  };

  it("rejects staff requests from outside the range and leaves public routes alone", async () => {
    const app = await build(["203.0.113.0/24"]);
    expect((await app.inject({ url: "/api/v1/staff/ping", remoteAddress: "198.51.100.1" })).statusCode).toBe(403);
    expect((await app.inject({ url: "/api/v1/staff/ping", remoteAddress: "203.0.113.9" })).statusCode).toBe(200);
    expect((await app.inject({ url: "/api/v1/healthz", remoteAddress: "198.51.100.1" })).statusCode).toBe(200);
    await app.close();
  });

  it("installs nothing when the allowlist is empty", async () => {
    const app = await build([]);
    expect((await app.inject({ url: "/api/v1/staff/ping", remoteAddress: "198.51.100.1" })).statusCode).toBe(200);
    await app.close();
  });
});
