/**
 * @file App.test.tsx
 * @module engage-mt/staff
 * @description Render smoke for the staff console shell: an unauthenticated
 *              visitor lands on the sign-in screen; a signed-in editor sees the
 *              navigation shell.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-05
 * @updated 2026-09-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({
  me: vi.fn(),
  seasonYears: vi.fn(),
  logout: vi.fn(),
  auditLog: vi.fn(async () => ({ rows: [], nextCursor: null })),
}));
vi.mock("./api.js", () => ({
  ApiError: class extends Error {},
  api: new Proxy({ me: h.me, seasonYears: h.seasonYears, logout: h.logout, auditLog: h.auditLog }, {
    get: (t, k) => (k in t ? t[k as keyof typeof t] : vi.fn().mockResolvedValue([])),
  }),
}));

import { App } from "./App.js";

beforeEach(() => {
  h.me.mockReset();
  h.seasonYears.mockReset().mockResolvedValue([]);
});

describe("staff console shell", () => {
  it("shows the sign-in screen when there is no session", async () => {
    h.me.mockRejectedValue(new Error("UNAUTHORIZED"));
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows the navigation shell for a signed-in editor", async () => {
    h.me.mockResolvedValue([{ email: "e@fwp.mt.gov", displayName: "Editor", role: "editor", mustReset: false }]);
    render(
      <MemoryRouter initialEntries={["/districts"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("navigation", { name: /sections/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Districts" })).toBeInTheDocument();
  });

  it("routes a signed-in approver to the audit log", async () => {
    h.me.mockResolvedValue([{ email: "a@fwp.mt.gov", displayName: "Approver", role: "approver", mustReset: false }]);
    render(
      <MemoryRouter initialEntries={["/audit"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: /audit log/i })).toBeInTheDocument();
  });
});
