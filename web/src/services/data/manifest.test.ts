/**
 * @file manifest.test.ts
 * @module engage-mt/services/data
 * @description Single-flight loading, expiry arithmetic, and the entry hook.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  fetchDataManifest,
  isDatasetExpired,
  resetDataManifest,
  useDatasetManifestEntry,
} from "./manifest";

const manifest = {
  version: "t",
  generatedAt: "2026-09-01T00:00:00Z",
  manifestSchemaVersion: "1.2",
  appVersion: "1.0.0",
  datasets: [
    {
      id: "usgs-gages",
      file: "/data/usgs-gages.json",
      format: "json",
      schemaVersion: "1.0",
      effectiveDate: "2026-09-01",
      expiresDate: "2026-09-05",
      rowCount: 1,
      sizeBytes: 1,
      sha256: "x",
      source: "USGS",
      provenanceTier: "extracted",
      license: "Public domain",
    },
  ],
};

beforeEach(() => {
  resetDataManifest();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(manifest), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("data manifest", () => {
  it("loads once per session", async () => {
    await fetchDataManifest();
    await fetchDataManifest();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("expires the day after expiresDate", () => {
    const entry = { expiresDate: "2026-09-05" };
    expect(isDatasetExpired(entry, new Date("2026-09-05T23:00:00Z"))).toBe(false);
    expect(isDatasetExpired(entry, new Date("2026-09-06T00:00:00Z"))).toBe(true);
    expect(isDatasetExpired({}, new Date())).toBe(false);
  });

  it("the hook resolves an entry with its expiry", async () => {
    const { result } = renderHook(() => useDatasetManifestEntry("usgs-gages"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entry?.source).toBe("USGS");
    expect(result.current.expired).toBe(true);
  });

  it("the hook reports a missing dataset as null", async () => {
    const { result } = renderHook(() => useDatasetManifestEntry("nothing"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entry).toBeNull();
  });
});
