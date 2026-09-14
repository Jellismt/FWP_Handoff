/**
 * @file photoStorage.test.ts
 * @module engage-mt/services/field
 * @description Backend A+ pass — covers the web branch of the photo-storage
 *              abstraction: on the web target persistPhoto returns the input
 *              data-URI verbatim (no filesystem) and deletePhotoFile is a no-op.
 *              The Capacitor branch is exercised on-device only.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-13
 * @updated 2026-06-13
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/capacitor", () => ({ isCapacitor: () => false }));

import { persistPhoto, deletePhotoFile } from "./photoStorage";

afterEach(() => vi.restoreAllMocks());

describe("photoStorage (web target)", () => {
  it("returns the data-URI unchanged on the web", async () => {
    const uri = "data:image/jpeg;base64,AAAA";
    await expect(persistPhoto("photo-1", uri)).resolves.toBe(uri);
  });

  it("returns even a non-data-URI string unchanged on the web", async () => {
    await expect(persistPhoto("photo-2", "blob:whatever")).resolves.toBe("blob:whatever");
  });

  it("deletePhotoFile resolves without throwing on the web", async () => {
    await expect(deletePhotoFile("photo-1")).resolves.toBeUndefined();
  });
});
