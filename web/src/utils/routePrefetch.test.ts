/**
 * @file routePrefetch.test.ts
 * @module engage-mt/utils
 * @description Route prefetch registry: registered paths warm their chunk,
 *              unknown paths are a no-op, and `prefetchProps` wires both
 *              hover and focus.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, vi } from "vitest";
import { prefetchProps, prefetchRoute, registerPrefetch } from "./routePrefetch";

describe("routePrefetch", () => {
  it("calls the registered factory on every prefetch and ignores unknown paths", () => {
    const factory = vi.fn().mockResolvedValue(undefined);
    registerPrefetch("/x", factory);
    prefetchRoute("/x");
    prefetchRoute("/x");
    prefetchRoute("/nope");
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("prefetchProps warms the route on hover and on keyboard focus", () => {
    const factory = vi.fn().mockResolvedValue(undefined);
    registerPrefetch("/y", factory);
    const props = prefetchProps("/y");
    props.onPointerEnter();
    props.onFocus();
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
