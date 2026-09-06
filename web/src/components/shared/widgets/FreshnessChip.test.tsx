/**
 * @file FreshnessChip.test.tsx
 * @module engage-mt/shared
 * @description Coverage for the FreshnessChip.
 *              Each freshness category renders the right label + class;
 *              the stale + sample-fixture variants ladder onto the
 *              base; compact drops source + lastUpdate; versioned with
 *              effectiveDate replaces the label.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FreshnessChip } from "@/components/shared/widgets/FreshnessChip";

describe("FreshnessChip", () => {
  it("realtime renders a Live label + class", () => {
    const { container } = render(<FreshnessChip freshness="realtime" source="USGS" />);
    expect(screen.getByText("Live")).toBeTruthy();
    expect(container.querySelector(".freshness-chip--realtime")).toBeTruthy();
  });

  it("hourly / daily / weekly / static all render their label", () => {
    ["hourly", "daily", "weekly", "static"].forEach((f) => {
      const { unmount } = render(
        <FreshnessChip freshness={f as "hourly" | "daily" | "weekly" | "static"} source="x" />,
      );
      const expected = f.charAt(0).toUpperCase() + f.slice(1);
      expect(screen.getByText(expected)).toBeTruthy();
      unmount();
    });
  });

  it("versioned + effectiveDate becomes 'Effective <date>'", () => {
    render(<FreshnessChip freshness="versioned" source="FWP regs" effectiveDate="2026-03-01" />);
    expect(screen.getByText("Effective 2026-03-01")).toBeTruthy();
  });

  it("compact drops the source + lastUpdate suffix", () => {
    const { container } = render(
      <FreshnessChip
        freshness="daily"
        source="should not appear"
        lastUpdate="2026-06-06"
        compact
      />,
    );
    expect(container.textContent).not.toContain("should not appear");
    expect(container.textContent).not.toContain("2026-06-06");
  });

  it("stale appends ' · Stale' + an SR warning", () => {
    render(<FreshnessChip freshness="daily" source="x" stale />);
    expect(screen.getByText(/Daily · Stale/i)).toBeTruthy();
    expect(screen.getByText(/data may be out of date/i)).toBeTruthy();
  });

  it("auto-infers sampleFixture from the source string and appends ' · Sample'", () => {
    render(<FreshnessChip freshness="versioned" source="FWP regs (sample fixture)" />);
    expect(screen.getByText(/· Sample/)).toBeTruthy();
    expect(screen.getByText(/sample fixture, not the live FWP feed/i)).toBeTruthy();
  });

  it("explicit sampleFixture=false overrides the auto-inference", () => {
    render(
      <FreshnessChip
        freshness="versioned"
        source="FWP regs (sample fixture)"
        sampleFixture={false}
      />,
    );
    expect(screen.queryByText(/· Sample/)).toBeNull();
  });

  it("non-compact renders source + a readable 'as of' lastUpdate, keeping the ISO in the time element", () => {
    const { container } = render(
      <FreshnessChip freshness="daily" source="USGS" lastUpdate="2026-06-06T12:00:00Z" />,
    );
    expect(screen.getByText("USGS")).toBeTruthy();
    // The visible text is the humanized "as of …" form, not the raw ISO string.
    const time = container.querySelector("time.freshness-chip__updated");
    expect(time).toBeTruthy();
    expect(time?.getAttribute("dateTime")).toBe("2026-06-06T12:00:00Z");
    expect(time?.textContent).toMatch(/^as of /);
  });

  it("names a downloaded or built-in copy and reads it out", () => {
    const { unmount } = render(
      <FreshnessChip freshness="versioned" source="FWP" effectiveDate="2026-03-01" fieldCopy />,
    );
    expect(screen.getByText(/Effective 2026-03-01 · Downloaded copy/)).toBeTruthy();
    expect(screen.getByText(/Copy saved to this device/)).toBeTruthy();
    unmount();
    render(<FreshnessChip freshness="versioned" source="FWP" effectiveDate="2026-03-01" bundled />);
    expect(screen.getByText(/· Built-in copy/)).toBeTruthy();
  });
});
