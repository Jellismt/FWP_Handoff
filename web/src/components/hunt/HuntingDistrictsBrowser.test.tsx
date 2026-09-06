/**
 * @file HuntingDistrictsBrowser.test.tsx
 * @module engage-mt/hunt
 * @description Behavior coverage for the district-lookup tool: species pick
 *              gates the number input, a typed number resolves against the
 *              bundled facts catalog, and opening a match navigates to the
 *              district report. The map guidance note is asserted so the
 *              spatial path stays discoverable.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => navigate };
});

vi.mock("@/hooks/useFetchJson", () => ({
  useFetchJson: () => ({
    data: [
      { district: "380", region: 3, name: "Madison", acres: 1_200_000, counties: "Madison" },
      { district: "388", region: 3, name: "Tobacco Root", acres: 400_000, counties: "Madison" },
      { district: "100", region: 1, name: "Kootenai", acres: 900_000, counties: "Lincoln" },
    ],
    error: null,
    retry: () => undefined,
  }),
}));

import { HuntingDistrictsBrowser } from "./HuntingDistrictsBrowser";

const renderPage = () =>
  render(
    <MemoryRouter>
      <HuntingDistrictsBrowser />
    </MemoryRouter>,
  );

describe("HuntingDistrictsBrowser", () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it("gates the district-number input until a species is picked", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: /hunting districts/i })).toBeTruthy();
    const input = screen.getByLabelText<HTMLInputElement>(/district number/i);
    expect(input.disabled).toBe(true);
    // The map guidance note is always present.
    expect(screen.getByText(/tap any district and this same district report/i)).toBeTruthy();
  });

  it("resolves a typed number to matching districts and opens the report", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Elk" }));
    const input = screen.getByLabelText<HTMLInputElement>(/district number/i);
    expect(input.disabled).toBe(false);

    await user.type(input, "38");
    expect(screen.getByText(/HD 380 — Madison/)).toBeTruthy();
    expect(screen.getByText(/HD 388 — Tobacco Root/)).toBeTruthy();
    expect(screen.queryByText(/HD 100/)).toBeNull();

    await user.click(screen.getByRole("button", { name: /open district 380/i }));
    expect(navigate).toHaveBeenCalledWith("/hunt/district/380");
  });

  it("shows the no-match state for an unknown number", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Deer" }));
    await user.type(screen.getByLabelText(/district number/i), "999");
    expect(screen.getByText(/no district matches that number/i)).toBeTruthy();
  });
});
