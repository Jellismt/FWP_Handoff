/**
 * @file RestrictedAreasSection.test.tsx
 * @module engage-mt/hunt
 * @description Verifies the restricted-areas enrichment renders linked areas and — per the
 *              "never degrade the panel" contract — renders nothing when there are none.
 *              The enrichment hook is mocked at the seam.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RestrictedArea } from "@/services/regsApi/types";

const h = vi.hoisted(() => ({ areas: [] as RestrictedArea[] }));
vi.mock("@/hooks/useDistrictEnrichment", () => ({
  useRestrictedAreas: () => h.areas,
}));

import { RestrictedAreasSection } from "./RestrictedAreasSection";

beforeEach(() => {
  h.areas = [];
});

describe("RestrictedAreasSection", () => {
  it("renders nothing when the district has no restricted areas", () => {
    const { container } = render(<RestrictedAreasSection hd="700" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders each linked area with its type + legal description", () => {
    h.areas = [
      {
        area_type: "WEAPONS_RESTR",
        area_name: "Prickly Pear WRA",
        legal_desc: "Bounded by...",
        districts: ["388"],
      },
    ];
    render(<RestrictedAreasSection hd="388" />);
    expect(screen.getByRole("heading", { name: /restricted areas here/i })).toBeTruthy();
    expect(screen.getByText("Prickly Pear WRA")).toBeTruthy();
    expect(screen.getByText(/weapons restriction area/i)).toBeTruthy();
    expect(screen.getByText(/bounded by/i)).toBeTruthy();
  });
});
