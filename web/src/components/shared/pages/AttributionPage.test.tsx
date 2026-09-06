/**
 * @file AttributionPage.test.tsx
 * @module engage-mt/shared
 * @description Layer sources, bundled datasets with expiry, basemaps, and the
 *              built-in regulations version all render from their sources.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/services/data/manifest", async (importActual) => ({
  ...(await importActual<typeof import("@/services/data/manifest")>()),
  fetchDataManifest: async () => ({
    datasets: [
      {
        id: "usgs-gages",
        file: "/data/usgs-gages.json",
        format: "json",
        schemaVersion: "1.0",
        effectiveDate: "2026-09-01",
        expiresDate: "2020-01-01",
        rowCount: 1,
        sizeBytes: 1,
        sha256: "x",
        source: "USGS NWIS Site Service",
        provenanceTier: "extracted",
        license: "Public domain",
        upstreamUrl: "https://waterservices.usgs.gov/",
      },
    ],
  }),
}));
vi.mock("@/services/regs/bundledRegsSnapshot", () => ({
  loadBundledRegsSnapshot: async () => ({
    "hunting-regulations-unified": {
      data: [],
      meta: {
        generatedAt: "2026-09-05T00:00:00Z",
        effectiveDate: "2026-03-01",
        validUntil: "2027-02-28",
        sourceLabel: "FWP — 2026 DEA hunting regulations",
        version: 9,
      },
    },
  }),
}));

import { layerSourceGroups } from "@/config/layerSources";
import { AttributionPage } from "./AttributionPage";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("AttributionPage", () => {
  it("groups layers by source and skips composites", () => {
    const groups = layerSourceGroups();
    expect(groups.length).toBeGreaterThan(3);
    expect(groups.some((g) => g.layers.includes("Stream gages"))).toBe(false);
    expect(groups.every((g) => g.layers.length > 0)).toBe(true);
  });

  it("lists datasets with expiry, basemaps, and the built-in regulations version", async () => {
    const { container } = render(
      <MemoryRouter>
        <AttributionPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("usgs-gages")).toBeInTheDocument());
    expect(screen.getByText(/Expired 2020-01-01/)).toBeInTheDocument();
    expect(container.querySelector(".attribution-page__item--expired")).not.toBeNull();
    expect(screen.getByText(/The National Map/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/version 9, effective 2026-03-01/)).toBeInTheDocument(),
    );
  });
});
