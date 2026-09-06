/**
 * @file useFocusTrap.test.tsx
 * @module engage-mt/hooks
 * @description Tests for the focus-trap hook's background-inert behavior
 *              (WCAG 2.4.3): while active it marks sibling body children
 *              `inert` and restores them exactly on deactivate, and it never
 *              inerts the modal's own subtree (so a backdrop stays clickable).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/** Build `body > [#bg, shell > [backdrop, panel]]` and return the pieces. */
function mountModalDom(): {
  bg: HTMLElement;
  shell: HTMLElement;
  backdrop: HTMLElement;
  panel: HTMLElement;
} {
  const bg = document.createElement("div");
  bg.id = "bg";
  bg.innerHTML = '<button type="button">background action</button>';

  const shell = document.createElement("div");
  const backdrop = document.createElement("div");
  const panel = document.createElement("div");
  panel.innerHTML = '<button type="button">close</button>';
  shell.append(backdrop, panel);

  document.body.append(bg, shell);
  return { bg, shell, backdrop, panel };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useFocusTrap background inert", () => {
  it("inerts sibling body content while active and restores it on deactivate", () => {
    const { bg, shell, panel } = mountModalDom();
    const ref = createRef<HTMLElement>();
    ref.current = panel;

    const { rerender } = renderHook(({ active }) => useFocusTrap({ active, containerRef: ref }), {
      initialProps: { active: true },
    });

    // Background sibling is inert; the modal shell (contains the panel) is not.
    expect(bg.hasAttribute("inert")).toBe(true);
    expect(shell.hasAttribute("inert")).toBe(false);

    rerender({ active: false });
    expect(bg.hasAttribute("inert")).toBe(false);
  });

  it("leaves the modal's own backdrop interactive (does not inert the shell)", () => {
    const { shell, backdrop, panel } = mountModalDom();
    const ref = createRef<HTMLElement>();
    ref.current = panel;

    renderHook(() => useFocusTrap({ active: true, containerRef: ref }));

    // The backdrop lives inside the shell that contains the panel, so it is
    // never inerted — click-to-dismiss keeps working.
    expect(shell.hasAttribute("inert")).toBe(false);
    expect(backdrop.hasAttribute("inert")).toBe(false);
  });

  it("does not inert anything when inertBackground is false", () => {
    const { bg, panel } = mountModalDom();
    const ref = createRef<HTMLElement>();
    ref.current = panel;

    renderHook(() => useFocusTrap({ active: true, containerRef: ref, inertBackground: false }));

    expect(bg.hasAttribute("inert")).toBe(false);
  });

  it("does not clear an inert attribute it did not set", () => {
    const { bg, panel } = mountModalDom();
    bg.setAttribute("inert", ""); // pre-existing, not ours
    const ref = createRef<HTMLElement>();
    ref.current = panel;

    const { rerender } = renderHook(({ active }) => useFocusTrap({ active, containerRef: ref }), {
      initialProps: { active: true },
    });

    rerender({ active: false });
    // We skipped it on the way in, so we must not strip it on the way out.
    expect(bg.hasAttribute("inert")).toBe(true);
  });
});

/** A dialog DOM with a trigger + a two-button panel, all as body children. */
function mountDialogWithTrigger(): {
  trigger: HTMLButtonElement;
  panel: HTMLElement;
  first: HTMLButtonElement;
  last: HTMLButtonElement;
} {
  const trigger = document.createElement("button");
  trigger.textContent = "open";
  const panel = document.createElement("div");
  panel.tabIndex = -1;
  const first = document.createElement("button");
  first.textContent = "first";
  const last = document.createElement("button");
  last.textContent = "last";
  panel.append(first, last);
  document.body.append(trigger, panel);
  return { trigger, panel, first, last };
}

const pressKey = (key: string, opts: KeyboardEventInit = {}): void => {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true, ...opts }));
};

describe("useFocusTrap activation + restore", () => {
  it("focuses the first focusable inside the container on activate", () => {
    const { trigger, panel, first } = mountDialogWithTrigger();
    trigger.focus();
    const ref = createRef<HTMLElement>();
    ref.current = panel;

    renderHook(() => useFocusTrap({ active: true, containerRef: ref }));

    expect(document.activeElement).toBe(first);
  });

  it("falls back to focusing the container when it has no focusables", () => {
    const { panel, first, last } = mountDialogWithTrigger();
    first.remove();
    last.remove();
    const focusSpy = vi.spyOn(panel, "focus");
    const ref = createRef<HTMLElement>();
    ref.current = panel;

    renderHook(() => useFocusTrap({ active: true, containerRef: ref }));

    expect(focusSpy).toHaveBeenCalled();
  });

  it("restores focus to the trigger on deactivate", () => {
    const { trigger, panel, first } = mountDialogWithTrigger();
    trigger.focus();
    const ref = createRef<HTMLElement>();
    ref.current = panel;

    const { rerender } = renderHook(({ active }) => useFocusTrap({ active, containerRef: ref }), {
      initialProps: { active: true },
    });
    expect(document.activeElement).toBe(first);

    rerender({ active: false });
    expect(document.activeElement).toBe(trigger);
  });
});

describe("useFocusTrap keyboard", () => {
  it("wraps Shift+Tab from the first focusable back to the last", () => {
    const { panel, first, last } = mountDialogWithTrigger();
    const ref = createRef<HTMLElement>();
    ref.current = panel;
    renderHook(() => useFocusTrap({ active: true, containerRef: ref }));

    first.focus();
    pressKey("Tab", { shiftKey: true });

    expect(document.activeElement).toBe(last);
  });

  it("wraps Tab from the last focusable back to the first", () => {
    const { panel, first, last } = mountDialogWithTrigger();
    const ref = createRef<HTMLElement>();
    ref.current = panel;
    renderHook(() => useFocusTrap({ active: true, containerRef: ref }));

    last.focus();
    pressKey("Tab");

    expect(document.activeElement).toBe(first);
  });

  it("invokes onEscape when Escape is pressed", () => {
    const { panel } = mountDialogWithTrigger();
    const onEscape = vi.fn();
    const ref = createRef<HTMLElement>();
    ref.current = panel;
    renderHook(() => useFocusTrap({ active: true, containerRef: ref, onEscape }));

    pressKey("Escape");

    expect(onEscape).toHaveBeenCalledOnce();
  });

  it("ignores non-Tab / non-Escape keys without changing focus", () => {
    const { panel, first } = mountDialogWithTrigger();
    const ref = createRef<HTMLElement>();
    ref.current = panel;
    renderHook(() => useFocusTrap({ active: true, containerRef: ref }));

    first.focus();
    pressKey("a");

    expect(document.activeElement).toBe(first);
  });
});
