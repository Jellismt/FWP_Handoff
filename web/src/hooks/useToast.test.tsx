/**
 * @file useToast.test.tsx
 * @module engage-mt/hooks
 * @description Coverage for `useToast`.
 *              Asserts the show/dismiss wires through to the toastStore.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast } from "./useToast";
import { useToastStore } from "@/store/app/toastStore";

describe("useToast", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it("exposes show + dismiss bound to the store", () => {
    const { result } = renderHook(() => useToast());
    expect(typeof result.current.show).toBe("function");
    expect(typeof result.current.dismiss).toBe("function");
  });

  it("show() pushes a toast into the store", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.show({ kind: "success", title: "Saved" });
    });
    expect(useToastStore.getState().toasts.length).toBe(1);
    expect(useToastStore.getState().toasts[0].title).toBe("Saved");
  });

  it("dismiss() removes the toast", () => {
    const { result } = renderHook(() => useToast());
    let id = "";
    act(() => {
      id = result.current.show({ kind: "success", title: "x" });
    });
    expect(useToastStore.getState().toasts.length).toBe(1);
    act(() => {
      result.current.dismiss(id);
    });
    expect(useToastStore.getState().toasts.length).toBe(0);
  });
});
