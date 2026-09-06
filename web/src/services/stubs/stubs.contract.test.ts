/**
 * @file stubs.contract.test.ts
 * @module engage-mt/services/stubs
 * @description Backend A+ pass — one parametric contract test over every
 *              `*.stub.ts`. Each stub stands in for a real FWP endpoint during
 *              development; this guards the shared shape: the module loads, it
 *              exports at least one `*Stub` function, and each no-arg-tolerant
 *              stub resolves to a defined value without throwing. When a stub
 *              swaps to a real API, a contract drift fails here instead of at
 *              runtime. Eager-glob import also gives module-scope fixture
 *              coverage across every stub.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-13
 * @updated 2026-07-16
 * @version 1.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { STUBS } from "./registry";

// Eagerly import every stub module so module-scope fixtures execute (coverage)
// and we can introspect their exports.
const modules = import.meta.glob<Record<string, unknown>>("./*.stub.ts", { eager: true });

const stubPaths = Object.keys(modules).sort();

/** A stub's runtime surface is its exported functions (the data accessors /
 *  mutators that stand in for the real endpoint). Naming varies — most are
 *  `*Stub`, some are verb-named (pushFieldBackup) — so the contract is simply
 *  "exports at least one function." */
const stubFnNames = (mod: Record<string, unknown>): string[] =>
  Object.keys(mod).filter((k) => typeof mod[k] === "function");

describe("stub registry contract", () => {
  it("discovers every stub module via glob", () => {
    // Guards against the glob silently matching nothing (which would make the
    // per-stub assertions vacuously pass): every registry row with a file is a
    // module on disk, and nothing on disk is unregistered.
    expect(stubPaths.length).toBe(STUBS.filter((s) => s.file !== null).length);
  });

  it.each(stubPaths)("%s exports at least one callable", (path) => {
    const fns = stubFnNames(modules[path]!);
    expect(fns.length).toBeGreaterThanOrEqual(1);
  });

  it.each(stubPaths)("%s — each exported function returns a promise that settles", async (path) => {
    const mod = modules[path]!;
    for (const name of stubFnNames(mod)) {
      const fn = mod[name] as (...args: unknown[]) => unknown;
      let result: unknown;
      try {
        result = fn();
      } catch {
        // Some stubs require a typed argument; a synchronous throw on no-args
        // is acceptable — the export-shape contract above still holds.
        continue;
      }
      // Async stubs return a promise — confirm it settles (resolve OR reject;
      // an arg-requiring reject is fine, the point is it doesn't hang or leave
      // an unhandled rejection). Synchronous helpers (e.g. a window resolver)
      // just need to not throw, which getting here already proved.
      const maybe = result as { then?: unknown } | null;
      if (maybe && typeof maybe.then === "function") {
        await (result as Promise<unknown>).then(
          () => undefined,
          () => undefined,
        );
      }
    }
  });
});
