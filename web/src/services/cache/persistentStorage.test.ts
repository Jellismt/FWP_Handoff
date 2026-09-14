/**
 * @file persistentStorage.test.ts
 * @module engage-mt/services/cache
 * @description Persistence is requested once, already-persisted origins are
 *              not asked again, and a missing API reports false.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestPersistentStorage, resetPersistentStorageRequest } from "./persistentStorage";

const install = (storage: unknown): void => {
  Object.defineProperty(navigator, "storage", { configurable: true, value: storage });
};

describe("requestPersistentStorage", () => {
  beforeEach(resetPersistentStorageRequest);
  afterEach(() => install(undefined));

  it("asks once and caches the answer", async () => {
    const persist = vi.fn(async () => true);
    install({ persisted: async () => false, persist });
    await expect(requestPersistentStorage()).resolves.toBe(true);
    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("does not ask again when already persisted", async () => {
    const persist = vi.fn(async () => true);
    install({ persisted: async () => true, persist });
    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it("reports false without the API or when it throws", async () => {
    install(undefined);
    await expect(requestPersistentStorage()).resolves.toBe(false);
    resetPersistentStorageRequest();
    install({
      persist: async () => {
        throw new Error("denied");
      },
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});
