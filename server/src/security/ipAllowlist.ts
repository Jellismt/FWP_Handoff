/**
 * @file ipAllowlist.ts
 * @module engage-mt/server/security
 * @description Parses STAFF_IP_ALLOWLIST — a comma-separated list of exact
 *              IPv4/IPv6 addresses and CIDR ranges — into a matcher built on
 *              Node's `net.BlockList`, so an agency network range can be
 *              expressed as one entry. IPv4-mapped IPv6 addresses (`::ffff:a.b.c.d`,
 *              what a proxied request can arrive as) are normalized to IPv4
 *              before matching. A malformed entry throws, so a typo fails the
 *              boot instead of silently opening or closing the staff routes.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { BlockList, isIPv4, isIPv6 } from "node:net";
import type { FastifyInstance } from "fastify";
import { fail } from "@engage-mt/regs-shared";

export interface IpAllowlist {
  /** False when no entries were configured — the staff routes are then open to any IP. */
  readonly enabled: boolean;
  readonly size: number;
  allows(ip: string): boolean;
}

const MAPPED_V4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

/** `::ffff:203.0.113.9` → `203.0.113.9`; anything else unchanged. */
export const normalizeIp = (ip: string): string => MAPPED_V4.exec(ip.trim())?.[1] ?? ip.trim();

const family = (ip: string): "ipv4" | "ipv6" | null =>
  isIPv4(ip) ? "ipv4" : isIPv6(ip) ? "ipv6" : null;

export function parseIpAllowlist(entries: readonly string[]): IpAllowlist {
  const list = new BlockList();
  let size = 0;
  for (const raw of entries) {
    const entry = raw.trim();
    if (!entry) continue;
    const [address, prefixText, ...rest] = entry.split("/");
    const ip = normalizeIp(address ?? "");
    const type = family(ip);
    if (!type || rest.length > 0) throw new Error(`STAFF_IP_ALLOWLIST: invalid entry "${entry}"`);
    if (prefixText === undefined) {
      list.addAddress(ip, type);
    } else {
      const prefix = Number(prefixText);
      const max = type === "ipv4" ? 32 : 128;
      if (!/^\d+$/.test(prefixText) || prefix > max) {
        throw new Error(`STAFF_IP_ALLOWLIST: invalid CIDR prefix in "${entry}"`);
      }
      list.addSubnet(ip, prefix, type);
    }
    size += 1;
  }
  return {
    enabled: size > 0,
    size,
    allows(candidate) {
      const ip = normalizeIp(candidate);
      const type = family(ip);
      return type !== null && list.check(ip, type);
    },
  };
}

/** Staff-route paths the allowlist protects. */
const STAFF_PREFIX = "/api/v1/staff";

/**
 * Reject requests to the staff surface from addresses outside the allowlist
 * before any route or auth work runs. A disabled allowlist installs nothing.
 */
export function registerStaffIpAllowlist(app: FastifyInstance, allowlist: IpAllowlist): void {
  if (!allowlist.enabled) return;
  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith(STAFF_PREFIX) && !allowlist.allows(request.ip)) {
      await reply
        .code(403)
        .send(fail([{ code: "FORBIDDEN", message: "Not permitted from this network." }]));
    }
  });
}
