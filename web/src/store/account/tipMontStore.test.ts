/**
 * @file tipMontStore.test.ts
 * @module engage-mt/store
 * @description Unit tests for the TipMont dialog store: openTipMont() flips
 *              the dialog open and close() shuts it.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { openTipMont, useTipMontStore } from "./tipMontStore";

describe("tipMontStore", () => {
  beforeEach(() => {
    useTipMontStore.setState({ open: false });
  });

  it("starts closed", () => {
    expect(useTipMontStore.getState().open).toBe(false);
  });

  it("openTipMont() opens the dialog", () => {
    openTipMont();
    expect(useTipMontStore.getState().open).toBe(true);
  });

  it("close() shuts the dialog", () => {
    openTipMont();
    useTipMontStore.getState().close();
    expect(useTipMontStore.getState().open).toBe(false);
  });
});
