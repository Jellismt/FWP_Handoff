/**
 * @file appLifecycle.behavior.test.ts
 * @module engage-mt/services/mobile
 * @description Behavior tests for the native app-lifecycle wiring
 *              (installAppLifecycle) — the parts the existing pure-helper
 *              suite doesn't touch. Mocks @capacitor/app at the import seam
 *              to verify the Back / resume / deep-link / shared-file /
 *              external-link / cold-start launch-URL listeners route through the
 *              right handlers, that install is idempotent + no-op on web, and
 *              that a plugin-load failure resolves quietly (never rejects).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-14
 * @version 1.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const h = vi.hoisted(() => ({
  isCapacitor: vi.fn(() => true),
  addListener: vi.fn(),
  exitApp: vi.fn(async () => undefined),
  getLaunchUrl: vi.fn(async () => null as { url: string } | null),
}));

vi.mock("@/utils/capacitor", () => ({ isCapacitor: h.isCapacitor }));
vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: h.addListener,
    exitApp: h.exitApp,
    getLaunchUrl: h.getLaunchUrl,
  },
}));

import { installAppLifecycle, type AppLifecycleHandlers } from "./appLifecycle";

/** Callbacks captured from App.addListener, keyed by event name. */
type ListenerCb = (data: { canGoBack?: boolean; url?: string }) => void;
const listeners = new Map<string, ListenerCb>();

const removeSpy = vi.fn(async () => undefined);

/**
 * Reset module-level `installed` flag by re-importing after resetModules is
 * impractical here (the mock seam must persist), so instead every test calls
 * the returned teardown, which flips `installed` back to false.
 */
let teardown: (() => void) | null = null;

interface MockHandlers extends AppLifecycleHandlers {
  goBack: Mock<() => void>;
  navigateTo: Mock<(path: string) => void>;
  onResume: Mock<() => void>;
  onSharedFile: Mock<(uri: string) => void>;
}

const makeHandlers = (overrides: Partial<AppLifecycleHandlers> = {}): MockHandlers => {
  const base: MockHandlers = {
    getPathname: () => "/hunt/districts",
    goBack: vi.fn<() => void>(),
    navigateTo: vi.fn<(path: string) => void>(),
    onResume: vi.fn<() => void>(),
    onSharedFile: vi.fn<(uri: string) => void>(),
  };
  // Only getPathname is ever overridden in these tests; keep the typed mocks.
  if (overrides.getPathname) base.getPathname = overrides.getPathname;
  return base;
};

/** Install + wait for the async IIFE inside installAppLifecycle to settle. */
const installAndFlush = async (handlers: AppLifecycleHandlers): Promise<void> => {
  teardown = installAppLifecycle(handlers);
  if (!h.isCapacitor()) return;
  // The install runs an async IIFE (dynamic import → awaited addListener chain →
  // getLaunchUrl). Poll until the listeners have attached rather than guessing a
  // fixed number of microtask flushes.
  await vi.waitFor(() => {
    if (h.addListener.mock.calls.length < 3) throw new Error("listeners not attached yet");
  });
  // One more macrotask so the trailing getLaunchUrl branch settles.
  await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  h.isCapacitor.mockReturnValue(true);
  h.getLaunchUrl.mockResolvedValue(null);
  h.addListener.mockImplementation(async (event: string, cb: ListenerCb) => {
    listeners.set(event, cb);
    return { remove: removeSpy };
  });
});

afterEach(() => {
  // Flip the module `installed` guard back so the next test can install fresh.
  teardown?.();
  teardown = null;
});

describe("installAppLifecycle — platform + idempotency guards", () => {
  it("is a no-op on web (never touches the plugin)", async () => {
    h.isCapacitor.mockReturnValue(false);
    const handlers = makeHandlers();
    await installAndFlush(handlers);
    expect(h.addListener).not.toHaveBeenCalled();
  });

  it("registers exactly the three lifecycle listeners on native", async () => {
    await installAndFlush(makeHandlers());
    expect(h.addListener).toHaveBeenCalledTimes(3);
    expect([...listeners.keys()].sort()).toEqual(["appUrlOpen", "backButton", "resume"]);
  });

  it("is idempotent — a second install while active attaches no new listeners", async () => {
    await installAndFlush(makeHandlers());
    expect(h.addListener).toHaveBeenCalledTimes(3);
    const second = installAppLifecycle(makeHandlers());
    await Promise.resolve();
    expect(h.addListener).toHaveBeenCalledTimes(3);
    second();
  });
});

describe("installAppLifecycle — Back button routing", () => {
  it("pops history on a deep screen with history behind it", async () => {
    const handlers = makeHandlers({ getPathname: () => "/hunt/districts" });
    await installAndFlush(handlers);
    listeners.get("backButton")?.({ canGoBack: true });
    expect(handlers.goBack).toHaveBeenCalledTimes(1);
    expect(h.exitApp).not.toHaveBeenCalled();
  });

  it("exits the app at a tab root", async () => {
    const handlers = makeHandlers({ getPathname: () => "/explore" });
    await installAndFlush(handlers);
    listeners.get("backButton")?.({ canGoBack: true });
    expect(h.exitApp).toHaveBeenCalledTimes(1);
    expect(handlers.goBack).not.toHaveBeenCalled();
  });

  it("reads the LIVE pathname via the getter, not a stale closure", async () => {
    let path = "/hunt"; // tab root → would exit
    const handlers = makeHandlers({ getPathname: () => path });
    await installAndFlush(handlers);
    path = "/hunt/district/380"; // user navigated deep after install
    listeners.get("backButton")?.({ canGoBack: true });
    expect(handlers.goBack).toHaveBeenCalledTimes(1);
    expect(h.exitApp).not.toHaveBeenCalled();
  });
});

describe("installAppLifecycle — resume", () => {
  it("invokes the onResume handler on the resume event", async () => {
    const handlers = makeHandlers();
    await installAndFlush(handlers);
    listeners.get("resume")?.({});
    expect(handlers.onResume).toHaveBeenCalledTimes(1);
  });
});

describe("installAppLifecycle — appUrlOpen routing", () => {
  it("navigates to the parsed path for a deep link", async () => {
    const handlers = makeHandlers();
    await installAndFlush(handlers);
    listeners.get("appUrlOpen")?.({ url: "engagemt://hunt/districts" });
    expect(handlers.navigateTo).toHaveBeenCalledWith("/hunt/districts");
  });

  it("routes a file:// share open to onSharedFile, not navigation", async () => {
    const handlers = makeHandlers();
    await installAndFlush(handlers);
    listeners.get("appUrlOpen")?.({ url: "file:///tmp/pin.gpx" });
    expect(handlers.onSharedFile).toHaveBeenCalledWith("file:///tmp/pin.gpx");
    expect(handlers.navigateTo).not.toHaveBeenCalled();
  });

  it("routes an external share link to the receive-page guidance state", async () => {
    const handlers = makeHandlers();
    await installAndFlush(handlers);
    listeners.get("appUrlOpen")?.({ url: "https://share.example.com/waypoint/abc" });
    expect(handlers.navigateTo).toHaveBeenCalledWith("/field/receive");
    expect(handlers.onSharedFile).not.toHaveBeenCalled();
  });

  it("ignores an unrecognized launch URL", async () => {
    const handlers = makeHandlers();
    await installAndFlush(handlers);
    listeners.get("appUrlOpen")?.({ url: "mailto:someone@example.com" });
    expect(handlers.navigateTo).not.toHaveBeenCalled();
    expect(handlers.onSharedFile).not.toHaveBeenCalled();
  });

  it("ignores an appUrlOpen event with no url", async () => {
    const handlers = makeHandlers();
    await installAndFlush(handlers);
    listeners.get("appUrlOpen")?.({});
    expect(handlers.navigateTo).not.toHaveBeenCalled();
  });
});

describe("installAppLifecycle — cold-start launch URL", () => {
  it("routes the cold-start getLaunchUrl through the same dispatch", async () => {
    h.getLaunchUrl.mockResolvedValue({ url: "engagemt://access/bma" });
    const handlers = makeHandlers();
    await installAndFlush(handlers);
    expect(handlers.navigateTo).toHaveBeenCalledWith("/access/bma");
  });

  it("survives getLaunchUrl throwing (unsupported platform) — listeners still attach", async () => {
    h.getLaunchUrl.mockRejectedValue(new Error("not implemented"));
    const handlers = makeHandlers();
    await installAndFlush(handlers);
    // The three listeners were still registered before the failing getLaunchUrl.
    expect(h.addListener).toHaveBeenCalledTimes(3);
  });
});

describe("installAppLifecycle — resilience", () => {
  it("resolves quietly when the plugin import path throws (never rejects)", async () => {
    // Simulate the whole listener-attach chain blowing up before any listener
    // attaches — installAndFlush's poll can't run here, so drive the settle
    // manually and assert nothing throws / no navigation happened.
    h.addListener.mockRejectedValue(new Error("bridge not ready"));
    const handlers = makeHandlers();
    teardown = installAppLifecycle(handlers);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(handlers.navigateTo).not.toHaveBeenCalled();
  });

  it("teardown removes every registered listener", async () => {
    const handlers = makeHandlers();
    await installAndFlush(handlers);
    expect(removeSpy).not.toHaveBeenCalled();
    teardown?.();
    teardown = null;
    expect(removeSpy).toHaveBeenCalledTimes(3);
  });
});
