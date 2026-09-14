/**
 * @file ToolIntroExplainer.test.tsx
 * @module engage-mt/map
 * @description Covers the map-first tool intro card: registry lookup
 *              from the `intro` param, no-render when absent/unknown, and the
 *              "Don't show again" persisted-dismiss path.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-06
 * @updated 2026-07-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToolIntroExplainer } from "./ToolIntroExplainer";
import { TOOL_INTROS } from "./toolIntros";
import { useToolIntroStore } from "@/store/app/toolIntroStore";

const renderAt = (search: string): void => {
  render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <ToolIntroExplainer />
    </MemoryRouter>,
  );
};

describe("ToolIntroExplainer", () => {
  beforeEach(() => {
    useToolIntroStore.setState({ dismissed: {} });
  });

  it("renders nothing with no intro param", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <ToolIntroExplainer />
      </MemoryRouter>,
    );
    expect(container.querySelector(".tool-intro")).toBeNull();
  });

  it("renders nothing for an unknown intro id", () => {
    renderAt("?intro=does-not-exist");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("renders the registered intro copy for a known id", () => {
    renderAt("?intro=fas");
    expect(screen.getByText(TOOL_INTROS.fas.title)).toBeInTheDocument();
    expect(screen.getByText(TOOL_INTROS.fas.body)).toBeInTheDocument();
  });

  it("'Don't show again' persists the dismissal", () => {
    renderAt("?intro=bma");
    fireEvent.click(screen.getByText(/Don.t show again/i));
    expect(useToolIntroStore.getState().isDismissed("bma")).toBe(true);
  });

  it("does not render once an intro has been dismissed", () => {
    useToolIntroStore.getState().dismiss("wmas");
    renderAt("?intro=wmas");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("every registered intro has a title and body", () => {
    for (const [id, intro] of Object.entries(TOOL_INTROS)) {
      expect(intro.title, `${id} title`).toBeTruthy();
      expect(intro.body, `${id} body`).toBeTruthy();
    }
  });
});
