/**
 * @file Tooltip.test.tsx
 * @module engage-mt/shared
 * @description Unit tests for the custom Tooltip wrapper. Covers: passthrough
 *              of a non-element child, the child still rendering normally, the
 *              reveal-after-delay on hover/focus (fake timers), the portal
 *              tooltip node carrying role=tooltip + the content + the
 *              placement class, the aria-describedby linkage toggling with
 *              open state, dismissal on mouse-leave / blur / Escape, the
 *              original child handlers still firing, and the touch-device
 *              suppression path. Positioning math is exercised via the open
 *              effect (happy-dom returns zero rects, so we assert the node +
 *              wiring, not pixel values).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { Tooltip } from "@/components/shared/overlays/Tooltip";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe("Tooltip — child passthrough", () => {
  it("renders a non-element child unchanged (no crash)", () => {
    // A raw string is not a valid element → returned as-is.
    const { container } = render(<Tooltip content="hi">{"plain text" as never}</Tooltip>);
    expect(container.textContent).toContain("plain text");
  });

  it("renders the wrapped child element", () => {
    const { getByRole } = render(
      <Tooltip content="Find your location">
        <button type="button">Locate</button>
      </Tooltip>,
    );
    expect(getByRole("button", { name: "Locate" })).toBeTruthy();
  });
});

describe("Tooltip — reveal + dismiss", () => {
  it("reveals the tooltip after the delay on hover, not immediately", () => {
    const { getByRole, queryByRole } = render(
      <Tooltip content="Explains the tool" delayMs={200}>
        <button type="button">Draw</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(getByRole("button"));
    // Before the delay elapses, no tooltip.
    expect(queryByRole("tooltip")).toBeNull();
    advance(200);
    const tip = getByRole("tooltip");
    expect(tip.textContent).toBe("Explains the tool");
    expect(tip.className).toMatch(/fwp-tooltip--top/);
  });

  it("uses the requested placement in the tooltip class", () => {
    const { getByRole } = render(
      <Tooltip content="Right side" placement="right" delayMs={100}>
        <button type="button">Locate</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(getByRole("button"));
    advance(100);
    expect(getByRole("tooltip").className).toMatch(/fwp-tooltip--right/);
  });

  it("links aria-describedby only while open", () => {
    const { getByRole, queryByRole } = render(
      <Tooltip content="desc" delayMs={100}>
        <button type="button">Measure</button>
      </Tooltip>,
    );
    const btn = getByRole("button");
    expect(btn.getAttribute("aria-describedby")).toBeNull();
    fireEvent.mouseEnter(btn);
    advance(100);
    const tipId = getByRole("tooltip").id;
    expect(btn.getAttribute("aria-describedby")).toBe(tipId);
    fireEvent.mouseLeave(btn);
    expect(queryByRole("tooltip")).toBeNull();
    expect(btn.getAttribute("aria-describedby")).toBeNull();
  });

  it("reveals on focus and dismisses on blur", () => {
    const { getByRole, queryByRole } = render(
      <Tooltip content="focus desc" delayMs={50}>
        <button type="button">Layers</button>
      </Tooltip>,
    );
    const btn = getByRole("button");
    fireEvent.focus(btn);
    advance(50);
    expect(getByRole("tooltip")).toBeTruthy();
    fireEvent.blur(btn);
    expect(queryByRole("tooltip")).toBeNull();
  });

  it("dismisses on Escape", () => {
    const { getByRole, queryByRole } = render(
      <Tooltip content="esc desc" delayMs={10}>
        <button type="button">Search</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(getByRole("button"));
    advance(10);
    expect(getByRole("tooltip")).toBeTruthy();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(queryByRole("tooltip")).toBeNull();
  });
});

describe("Tooltip — handler preservation + suppression", () => {
  it("still fires the child's own onMouseEnter handler", () => {
    const onMouseEnter = vi.fn();
    const { getByRole } = render(
      <Tooltip content="c" delayMs={5}>
        <button type="button" onMouseEnter={onMouseEnter}>
          Hover me
        </button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(getByRole("button"));
    expect(onMouseEnter).toHaveBeenCalledOnce();
  });

  it("suppresses the tooltip entirely on a touch device", () => {
    const spy = vi.spyOn(navigator, "maxTouchPoints", "get").mockReturnValue(5);
    const { getByRole, queryByRole } = render(
      <Tooltip content="no touch tips" delayMs={10}>
        <button type="button">Tap</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(getByRole("button"));
    advance(50);
    expect(queryByRole("tooltip")).toBeNull();
    spy.mockRestore();
  });
});
