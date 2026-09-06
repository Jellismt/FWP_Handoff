/**
 * @file prefetch.test.ts
 * @module engage-mt/routes
 * @description Every primary destination (each MODULE_NAV tab plus the
 *              districts browser, field tools, and offline maps) has a
 *              registered prefetch.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ registerPrefetch: vi.fn() }));
vi.mock("@/utils/routePrefetch", () => ({ registerPrefetch: h.registerPrefetch }));

import { MODULE_NAV } from "@/config/navigation";
import { PREFETCH_ROUTES, registerPrefetchRoutes } from "./prefetch";

describe("registerPrefetchRoutes", () => {
  it("registers every nav tab and the secondary destinations", () => {
    registerPrefetchRoutes();
    const registered = h.registerPrefetch.mock.calls.map(([path]) => path as string);
    for (const item of MODULE_NAV) expect(registered).toContain(item.path);
    for (const path of ["/hunt/districts", "/field", "/manage/offline-tiles"]) {
      expect(registered).toContain(path);
    }
    expect(registered).toHaveLength(PREFETCH_ROUTES.length);
  });
});
