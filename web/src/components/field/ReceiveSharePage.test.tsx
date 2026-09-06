/**
 * @file ReceiveSharePage.test.tsx
 * @module engage-mt/field
 * @description Guards the "open in the app instead" hand-off link on
 *              the web receive page: given a valid decoded share bundle, a web
 *              visitor sees an `engagemt://field/receive?d=…` anchor rebuilt from
 *              the payload so a phone that has the native app can take over.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ReceiveSharePage } from "./ReceiveSharePage";
import { buildShareBundle } from "@/services/field/pinShareCodec";
import { buildShareLink } from "@/services/field/shareLink";
import type { Waypoint } from "@/store/field/fieldToolsStore";

const waypoint: Waypoint = {
  id: "wp-recv-1",
  kind: "general",
  name: "Gate B",
  lat: 46.1,
  lon: -112.2,
  createdAt: "2026-07-07T12:00:00.000Z",
  updatedAt: "2026-07-07T12:00:00.000Z",
  photos: [],
  tags: [],
};

const renderAt = (encoded: string): void => {
  render(
    <MemoryRouter initialEntries={[`/field/receive?d=${encoded}`]}>
      <Routes>
        <Route path="/field/receive" element={<ReceiveSharePage />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("ReceiveSharePage app hand-off link", () => {
  it("offers an engagemt:// deep link for a decoded bundle on web", () => {
    const { encoded } = buildShareLink(buildShareBundle({ waypoints: [waypoint] }));
    renderAt(encoded);
    const link = screen.getByRole("link", { name: /open it there instead/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("engagemt://field/receive?d="));
  });

  it("does not show the hand-off link on a bad payload (guidance state)", () => {
    renderAt("not-a-valid-bundle");
    expect(screen.queryByRole("link", { name: /open it there instead/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Couldn't open this pin/i)).toBeInTheDocument();
  });
});
