/**
 * @file focusReturn.test.ts
 * @module engage-mt/utils
 * @description Coverage for `focusReturn.ts` — the modal focus-return helper.
 *              Verifies the remembered trigger is refocused on close, that a
 *              detached or absent trigger is a safe no-op, and that the double
 *              rAF that beats the MapView focus-grab actually resolves to a
 *              focus() call.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-20
 * @updated 2026-07-20
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { rememberFocusTrigger, returnFocusToTrigger } from "./focusReturn";

/** Run any queued requestAnimationFrame callbacks to completion (2 nested). */
const flushRaf = (): void => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
};

describe("focusReturn", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("returns focus to the element that was focused when remembered", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.focus();
    expect(document.activeElement).toBe(btn);

    rememberFocusTrigger();
    // Something else takes focus (as the map surface would).
    const other = document.createElement("input");
    document.body.appendChild(other);
    other.focus();
    expect(document.activeElement).toBe(other);

    flushRaf();
    returnFocusToTrigger();
    expect(document.activeElement).toBe(btn);
  });

  it("is a no-op when nothing was remembered", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    flushRaf();
    // No rememberFocusTrigger() call beforehand.
    returnFocusToTrigger();
    expect(document.activeElement).toBe(input);
  });

  it("does not throw when the remembered trigger has left the DOM", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.focus();
    rememberFocusTrigger();
    btn.remove();

    flushRaf();
    expect(() => returnFocusToTrigger()).not.toThrow();
  });

  it("ignores document.body as a trigger (treated as nothing focused)", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    document.body.focus(); // body is not a real trigger
    rememberFocusTrigger();
    input.focus();

    flushRaf();
    returnFocusToTrigger();
    // body was ignored, so focus stays where it is.
    expect(document.activeElement).toBe(input);
  });

  it("clears the remembered trigger after returning (second call is a no-op)", () => {
    const btn = document.createElement("button");
    const input = document.createElement("input");
    document.body.append(btn, input);
    btn.focus();
    rememberFocusTrigger();

    flushRaf();
    returnFocusToTrigger();
    expect(document.activeElement).toBe(btn);

    input.focus();
    returnFocusToTrigger(); // nothing remembered now
    expect(document.activeElement).toBe(input);
  });
});
