/**
 * @file sessionPurge.ts
 * @module engage-mt/server/auth
 * @description Fastify plugin that sweeps expired and idle staff sessions on
 *              boot and then hourly, so rows for sessions whose cookie never
 *              comes back do not accumulate. The timer is unref'd (it never
 *              keeps the process alive) and cleared on close; a failing sweep
 *              is logged and retried next tick. Safe with several API replicas —
 *              the DELETE is idempotent.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyInstance } from "fastify";
import { purgeExpiredSessions } from "./sessions.js";

export const DEFAULT_PURGE_INTERVAL_MS = 60 * 60 * 1000;

export async function sessionPurge(
  app: FastifyInstance,
  opts: { intervalMs?: number } = {},
): Promise<void> {
  const intervalMs = opts.intervalMs ?? DEFAULT_PURGE_INTERVAL_MS;
  const sweep = async (): Promise<void> => {
    try {
      const purged = await purgeExpiredSessions();
      app.log.debug({ purged }, "session purge");
    } catch (err) {
      app.log.warn({ err }, "session purge failed; will retry");
    }
  };
  let timer: NodeJS.Timeout | null = null;
  app.addHook("onReady", async () => {
    await sweep();
    timer = setInterval(() => void sweep(), intervalMs);
    timer.unref();
  });
  app.addHook("onClose", async () => {
    if (timer) clearInterval(timer);
  });
}
