/**
 * @file toastStore.test.ts
 * @module engage-mt/store
 * @description Toast queue behavior. Add / remove / id-uniqueness.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useToastStore } from "@/store/app/toastStore";

describe("toastStore", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it("starts empty", () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("show() appends to the queue + returns an id", () => {
    const id = useToastStore.getState().show({ kind: "success", title: "Saved" });
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    const t = useToastStore.getState().toasts;
    expect(t.length).toBe(1);
    expect(t[0]!.title).toBe("Saved");
    expect(t[0]!.id).toBe(id);
  });

  it("ids are unique across show() calls", () => {
    const a = useToastStore.getState().show({ kind: "info", title: "1" });
    const b = useToastStore.getState().show({ kind: "info", title: "2" });
    const c = useToastStore.getState().show({ kind: "info", title: "3" });
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("dismiss() removes the matching toast only", () => {
    const a = useToastStore.getState().show({ kind: "info", title: "1" });
    useToastStore.getState().show({ kind: "info", title: "2" });
    useToastStore.getState().dismiss(a);
    const t = useToastStore.getState().toasts;
    expect(t.length).toBe(1);
    expect(t[0]!.title).toBe("2");
  });

  it("dismiss() on an unknown id is a no-op", () => {
    useToastStore.getState().show({ kind: "info", title: "X" });
    useToastStore.getState().dismiss("not-an-id");
    expect(useToastStore.getState().toasts.length).toBe(1);
  });

  // Cap + dedup behavior.
  it("caps the queue at 3 toasts, dropping the oldest", () => {
    useToastStore.getState().show({ kind: "info", title: "1" });
    useToastStore.getState().show({ kind: "info", title: "2" });
    useToastStore.getState().show({ kind: "info", title: "3" });
    useToastStore.getState().show({ kind: "info", title: "4" });
    const t = useToastStore.getState().toasts;
    expect(t.length).toBe(3);
    expect(t.map((x) => x.title)).toEqual(["2", "3", "4"]);
  });

  it("dedups by kind + title — duplicates do not stack", () => {
    useToastStore.getState().show({ kind: "success", title: "Saved" });
    useToastStore.getState().show({ kind: "success", title: "Saved" });
    useToastStore.getState().show({ kind: "success", title: "Saved" });
    expect(useToastStore.getState().toasts.length).toBe(1);
  });

  it("dedups even when message differs (kind+title is the key)", () => {
    useToastStore.getState().show({ kind: "warning", title: "Heads up", message: "First" });
    useToastStore.getState().show({ kind: "warning", title: "Heads up", message: "Second" });
    const t = useToastStore.getState().toasts;
    expect(t.length).toBe(1);
    expect(t[0]!.message).toBe("First");
  });
});
