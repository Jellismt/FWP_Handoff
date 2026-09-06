/**
 * @file ToolHero.test.tsx
 * @module engage-mt/shared
 * @description Unit tests for the shared tool-page hero. Pins the byte-identical
 *              markup contract every tool page depends on: the
 *              `fwp-tool-hero` band with `data-module`, the `<h1>` title (with
 *              an optional wired id), the lede, and the optional backLink
 *              (above the title) + children (after the lede) passthroughs.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolHero } from "@/components/shared/ToolHero";

describe("ToolHero", () => {
  it("renders the invariant band with the module data attribute + title/lede", () => {
    const { container } = render(
      <ToolHero module="hunt" title="Hunting Districts" lede="A lede." />,
    );
    const band = container.querySelector(".fwp-tool-hero");
    expect(band).toBeTruthy();
    expect(band?.getAttribute("data-module")).toBe("hunt");
    expect(screen.getByRole("heading", { level: 1, name: "Hunting Districts" })).toBeTruthy();
    expect(container.querySelector(".fwp-tool-hero__lede")?.textContent).toBe("A lede.");
  });

  it("wires the title id when provided (for aria-labelledby)", () => {
    render(<ToolHero module="fish" title="T" titleId="my-heading" lede="l" />);
    expect(screen.getByRole("heading", { level: 1 }).id).toBe("my-heading");
  });

  it("omits the title id attribute when not provided", () => {
    render(<ToolHero module="fish" title="T" lede="l" />);
    expect(screen.getByRole("heading", { level: 1 }).id).toBe("");
  });

  it("renders a backLink above the title", () => {
    const { container } = render(
      <ToolHero
        module="access"
        title="T"
        lede="l"
        backLink={<span className="my-back">← Back</span>}
      />,
    );
    const band = container.querySelector(".fwp-tool-hero")!;
    const first = band.firstElementChild;
    expect(first?.className).toBe("my-back");
  });

  it("renders trailing children after the lede", () => {
    render(
      <ToolHero module="explore" title="T" lede="l">
        <div data-testid="trailing" />
      </ToolHero>,
    );
    expect(screen.getByTestId("trailing")).toBeTruthy();
  });

  it("renders ReactNode content (inline markup) in title/lede", () => {
    render(
      <ToolHero
        module="manage"
        title="T"
        lede={
          <>
            plain <strong>bold</strong>
          </>
        }
      />,
    );
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });
});
