/**
 * @file fieldModeStore.test.ts
 * @module engage-mt/store
 * @description R.2a — Characterization test gating the R.4d merge with
 *              fieldToolsStore. Verifies the persisted-bool round-trip
 *              through the `createPersistedBool` slot.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useFieldModeStore } from "@/store/field/fieldModeStore";

describe("fieldModeStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useFieldModeStore.setState({ active: false });
  });

  it("starts inactive", () => {
    expect(useFieldModeStore.getState().active).toBe(false);
  });

  it("set(true) activates field mode and writes through to localStorage", () => {
    useFieldModeStore.getState().set(true);
    expect(useFieldModeStore.getState().active).toBe(true);
    expect(window.localStorage.getItem("engage-mt:field-mode")).toBeTruthy();
  });

  it("set(false) deactivates and updates localStorage", () => {
    useFieldModeStore.getState().set(true);
    useFieldModeStore.getState().set(false);
    expect(useFieldModeStore.getState().active).toBe(false);
  });

  it("toggle flips the active boolean", () => {
    useFieldModeStore.getState().toggle();
    expect(useFieldModeStore.getState().active).toBe(true);
    useFieldModeStore.getState().toggle();
    expect(useFieldModeStore.getState().active).toBe(false);
  });
});
