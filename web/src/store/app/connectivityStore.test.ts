/**
 * @file connectivityStore.test.ts
 * @module engage-mt/store
 * @description Verifies the connectivity store + window event listener wiring.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-07
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  installConnectivityListeners,
  isOnline,
  useConnectivityStore,
} from "@/store/app/connectivityStore";

describe("connectivityStore", () => {
  beforeEach(() => {
    useConnectivityStore.setState({ online: true, kind: "unknown", lastChangedAt: null });
  });

  it("starts online by default", () => {
    expect(isOnline()).toBe(true);
  });

  it("setOnline(false) flips state + records lastChangedAt", () => {
    const before = useConnectivityStore.getState().lastChangedAt;
    useConnectivityStore.getState().setOnline(false);
    const after = useConnectivityStore.getState();
    expect(after.online).toBe(false);
    expect(after.kind).toBe("none");
    expect(after.lastChangedAt).not.toBe(before);
  });

  it("setOnline with same value does not bump lastChangedAt", () => {
    useConnectivityStore.getState().setOnline(true);
    const ts1 = useConnectivityStore.getState().lastChangedAt;
    useConnectivityStore.getState().setOnline(true);
    const ts2 = useConnectivityStore.getState().lastChangedAt;
    expect(ts1).toBe(ts2);
  });

  it("installConnectivityListeners reacts to window events and is idempotent", () => {
    const teardown = installConnectivityListeners();
    // Second install should be a no-op (returns a no-op teardown).
    const teardown2 = installConnectivityListeners();
    window.dispatchEvent(new Event("offline"));
    expect(useConnectivityStore.getState().online).toBe(false);
    window.dispatchEvent(new Event("online"));
    expect(useConnectivityStore.getState().online).toBe(true);
    teardown();
    teardown2();
  });
});
