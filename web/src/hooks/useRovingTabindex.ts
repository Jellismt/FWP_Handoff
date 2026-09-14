/**
 * @file useRovingTabindex.ts
 * @module engage-mt/hooks
 * @description Roving tabindex for a toolbar: one item is the single Tab stop,
 *              arrow keys (plus Home/End) move focus between items, and the
 *              item last focused becomes the next Tab stop. Key handling only
 *              applies to items that are DOM descendants of the container, so
 *              a menu portaled to <body> from inside the toolbar keeps its own
 *              arrow-key behaviour.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

interface Options {
  /** Which descendants take part. Defaults to enabled buttons. */
  selector?: string;
  /** Which arrow keys move focus. */
  orientation?: "horizontal" | "vertical" | "both";
}

interface RovingTabindex {
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  onFocus: (e: React.FocusEvent<HTMLElement>) => void;
}

const DEFAULT_SELECTOR = "button:not([disabled])";

const NEXT_KEYS: Record<NonNullable<Options["orientation"]>, readonly string[]> = {
  horizontal: ["ArrowRight"],
  vertical: ["ArrowDown"],
  both: ["ArrowRight", "ArrowDown"],
};
const PREV_KEYS: Record<NonNullable<Options["orientation"]>, readonly string[]> = {
  horizontal: ["ArrowLeft"],
  vertical: ["ArrowUp"],
  both: ["ArrowLeft", "ArrowUp"],
};

export function useRovingTabindex(
  containerRef: RefObject<HTMLElement | null>,
  { selector = DEFAULT_SELECTOR, orientation = "vertical" }: Options = {},
): RovingTabindex {
  const currentRef = useRef<HTMLElement | null>(null);

  const items = useCallback((): HTMLElement[] => {
    const container = containerRef.current;
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => el.closest("[data-roving-root]") === container,
    );
  }, [containerRef, selector]);

  const setCurrent = useCallback(
    (next: HTMLElement | null): void => {
      const all = items();
      const target = next && all.includes(next) ? next : (all[0] ?? null);
      currentRef.current = target;
      for (const el of all) el.tabIndex = el === target ? 0 : -1;
    },
    [items],
  );

  // Assign the initial stop and keep it valid as items mount and unmount
  // (the rail adds and removes buttons with the platform and recorder state).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.setAttribute("data-roving-root", "");
    setCurrent(currentRef.current);
    const observer = new MutationObserver(() => {
      if (!currentRef.current || !container.contains(currentRef.current)) setCurrent(null);
      else setCurrent(currentRef.current);
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [containerRef, setCurrent]);

  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLElement>): void => {
      const target = e.target as HTMLElement;
      if (items().includes(target)) setCurrent(target);
    },
    [items, setCurrent],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>): void => {
      const all = items();
      const active = document.activeElement as HTMLElement | null;
      const index = active ? all.indexOf(active) : -1;
      if (index === -1) return;
      let next: number | null = null;
      if (NEXT_KEYS[orientation].includes(e.key)) next = (index + 1) % all.length;
      else if (PREV_KEYS[orientation].includes(e.key)) next = (index - 1 + all.length) % all.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = all.length - 1;
      if (next === null) return;
      e.preventDefault();
      setCurrent(all[next]);
      all[next].focus();
    },
    [items, orientation, setCurrent],
  );

  return { onKeyDown, onFocus };
}
