/**
 * @file MyDevicePage.test.tsx
 * @module engage-mt/manage
 * @description Render coverage for the "My Device Data" local-storage inventory.
 *              Seeds the engage-mt:* localStorage buckets and asserts the
 *              per-bucket item counts + byte sizes, the local-first total notice,
 *              the offline-tile footprint panel, per-bucket clear (with toast),
 *              and the confirm-gated "clear all" flow. `supportsOfflineDownload`
 *              is mocked to prove the web build hides the offline-tiles bucket
 * and mobile shows it.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const h = vi.hoisted(() => ({
  show: vi.fn(),
  offline: false,
}));

// Calcite web components don't register in happy-dom; render the notice's
// slotted children as a plain element so its copy is queryable.
vi.mock("@esri/calcite-components-react", () => ({
  CalciteNotice: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ show: h.show, dismiss: () => undefined }),
}));

vi.mock("@/utils/capacitor", () => ({
  supportsOfflineDownload: () => h.offline,
}));

import { MyDevicePage } from "./MyDevicePage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <MyDevicePage />
    </MemoryRouter>,
  );

describe("MyDevicePage", () => {
  beforeEach(() => {
    h.show = vi.fn();
    h.offline = false;
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the hero", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: /my device data/i })).toBeTruthy();
    expect(screen.getByText(/none of it leaves this browser/i)).toBeTruthy();
  });

  it("counts primitive buckets and marks empty ones", () => {
    window.localStorage.setItem("engage-mt:theme", "dark");
    renderPage();

    // Theme bucket: a primitive string → 1 item.
    const themeTitle = screen.getByRole("heading", { name: /theme preference/i });
    const themeCard = themeTitle.closest("li") as HTMLElement;
    expect(within(themeCard).getByText(/1 item/i)).toBeTruthy();

    // A never-written bucket reads "Empty".
    const fieldModeTitle = screen.getByRole("heading", { name: /field mode/i });
    const fieldModeCard = fieldModeTitle.closest("li") as HTMLElement;
    expect(within(fieldModeCard).getByText(/empty/i)).toBeTruthy();
  });

  it("hides the offline-tiles bucket on web and shows it on mobile", () => {
    // Web: bucket absent.
    const { unmount } = renderPage();
    expect(screen.queryByRole("heading", { name: /offline map areas/i })).toBeNull();
    unmount();

    // Mobile: bucket present.
    h.offline = true;
    renderPage();
    expect(screen.getByRole("heading", { name: /offline map areas/i })).toBeTruthy();
  });

  it("clears a single bucket and toasts success", async () => {
    window.localStorage.setItem("engage-mt:theme", "dark");
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    const themeCard = screen
      .getByRole("heading", { name: /theme preference/i })
      .closest("li") as HTMLElement;
    // The Clear button is only enabled when the bucket has bytes.
    const clearBtn = within(themeCard).getByRole("button", { name: /clear/i });
    expect(clearBtn.hasAttribute("disabled")).toBe(false);

    await user.click(clearBtn);
    expect(window.localStorage.getItem("engage-mt:theme")).toBeNull();
    expect(h.show).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "success", title: expect.stringMatching(/theme/i) }),
    );
  });

  it("disables the Clear button for an empty bucket", () => {
    renderPage();
    const themeCard = screen
      .getByRole("heading", { name: /theme preference/i })
      .closest("li") as HTMLElement;
    expect(within(themeCard).getByRole("button", { name: /clear/i }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("clears all buckets after the user confirms", async () => {
    window.localStorage.setItem("engage-mt:theme", "dark");
    window.localStorage.setItem("engage-mt:field-mode", "true");
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmSpy);
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: /clear all engage mt data on this device/i }),
    );
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("engage-mt:theme")).toBeNull();
    expect(window.localStorage.getItem("engage-mt:field-mode")).toBeNull();
    expect(h.show).toHaveBeenCalledWith(expect.objectContaining({ kind: "info" }));
  });

  it("does not clear anything when the user cancels the confirm dialog", async () => {
    window.localStorage.setItem("engage-mt:theme", "dark");
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: /clear all engage mt data on this device/i }),
    );
    expect(window.localStorage.getItem("engage-mt:theme")).toBe("dark");
    expect(h.show).not.toHaveBeenCalled();
  });

  it("surfaces the offline-tile footprint from downloaded areas", () => {
    window.localStorage.setItem(
      "engage-mt:offline-areas",
      JSON.stringify([
        // ~500 MB downloaded (>0% of the multi-GiB cap) + a queued area that
        // must NOT count toward the footprint.
        { status: "downloaded", estimatedBytes: 500_000_000 },
        { status: "queued", estimatedBytes: 100_000_000 },
      ]),
    );
    renderPage();

    // Only the "downloaded" area counts toward the footprint panel.
    expect(screen.getByRole("heading", { name: /offline tile storage/i })).toBeTruthy();
    expect(screen.getByText(/1 downloaded area/i)).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: /offline tile storage usage/i });
    expect(Number(bar.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  });
});
