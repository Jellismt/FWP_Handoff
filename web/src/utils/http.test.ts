/**
 * @file http.test.ts
 * @module engage-mt/utils
 * @description Backend A+ pass — covers the shared fetch surface: fetchJson /
 *              fetchText status→typed-error mapping, the timeout-vs-caller-abort
 *              distinction (timeout → retryable NetworkError; caller abort →
 *              terminal AbortError), and the withBackoff retry policy.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-13
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, fetchText, withBackoff } from "./http";
import { AuthError, DataError, NetworkError, NotFoundError, RateLimitError } from "./errors";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const okText = (body: string): Response => new Response(body, { status: 200 });

/** A fetch that never settles on its own, but rejects (AbortError) when its
 *  signal aborts — models a real hung request so timeout/abort paths fire. */
const hangingFetch = (): ((url: string, init?: RequestInit) => Promise<Response>) =>
  vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      const onAbort = (): void => reject(new DOMException("aborted", "AbortError"));
      if (signal?.aborted) onAbort();
      else signal?.addEventListener("abort", onAbort, { once: true });
    });
  });

/** A fetch whose HEADERS resolve immediately but whose BODY read never settles
 *  on its own — rejecting (AbortError) only when the request signal aborts.
 *  Models the CO-3 hang: a slow/stalled body stream after 200 OK. */
const hangingBodyFetch = (): ((url: string, init?: RequestInit) => Promise<Response>) =>
  vi.fn((_url: string, init?: RequestInit) => {
    const signal = init?.signal;
    const hang = <T>(): Promise<T> =>
      new Promise<T>((_res, reject) => {
        const onAbort = (): void => reject(new DOMException("aborted", "AbortError"));
        if (signal?.aborted) onAbort();
        else signal?.addEventListener("abort", onAbort, { once: true });
      });
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => hang<unknown>(),
      text: () => hang<string>(),
    } as unknown as Response);
  });

afterEach(() => vi.unstubAllGlobals());

describe("fetchJson", () => {
  it("returns parsed JSON on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok({ a: 1 })));
    await expect(fetchJson("https://x.test/y")).resolves.toEqual({ a: 1 });
  });

  it("times out a never-closing body read as a retryable NetworkError (CO-3)", async () => {
    // Headers arrive (200 OK) but `.json()` hangs — the timeout must still
    // fire and cover the decode phase, not just the header phase.
    vi.stubGlobal("fetch", hangingBodyFetch());
    await expect(fetchJson("https://x.test/slowbody", { timeoutMs: 10 })).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it("rethrows a caller abort during body read as a terminal AbortError (CO-3)", async () => {
    vi.stubGlobal("fetch", hangingBodyFetch());
    const ctrl = new AbortController();
    const p = fetchJson("https://x.test/slowbody2", { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toSatisfy(
      (e: unknown) => e instanceof DOMException && !(e instanceof NetworkError),
    );
  });

  it("maps 401/403 → AuthError, 404 → NotFoundError, 429 → RateLimitError, 5xx → NetworkError", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    await expect(fetchJson("https://x.test/a")).rejects.toBeInstanceOf(AuthError);

    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    await expect(fetchJson("https://x.test/b")).rejects.toBeInstanceOf(NotFoundError);

    fetchMock.mockResolvedValueOnce(
      new Response("", { status: 429, headers: { "retry-after": "7" } }),
    );
    await expect(fetchJson("https://x.test/c")).rejects.toBeInstanceOf(RateLimitError);

    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
    await expect(fetchJson("https://x.test/d")).rejects.toBeInstanceOf(NetworkError);
  });

  it("propagates the Retry-After seconds on RateLimitError", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "12" } })),
    );
    await fetchJson("https://x.test/r").catch((err: unknown) => {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterSeconds).toBe(12);
    });
  });

  it("throws DataError on unparseable JSON body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("not json", { status: 200 })),
    );
    await expect(fetchJson("https://x.test/j")).rejects.toBeInstanceOf(DataError);
  });

  it("wraps a thrown fetch (DNS/offline) as NetworkError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")));
    await expect(fetchJson("https://x.test/n")).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("fetchText", () => {
  it("returns the raw body string", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okText("<xml/>")));
    await expect(fetchText("https://x.test/x")).resolves.toBe("<xml/>");
  });

  it("maps non-OK to a typed error too", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })));
    await expect(fetchText("https://x.test/x")).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("timeout vs caller-abort", () => {
  it("surfaces a timeout as a (retryable) NetworkError", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    await expect(fetchJson("https://x.test/slow", { timeoutMs: 10 })).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it("rethrows a caller abort as a terminal AbortError (not NetworkError)", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const ctrl = new AbortController();
    ctrl.abort();
    await fetchJson("https://x.test/cancel", { signal: ctrl.signal }).then(
      () => expect.unreachable("should have rejected"),
      (err: unknown) => {
        expect(err).not.toBeInstanceOf(NetworkError);
        expect((err as Error).name).toBe("AbortError");
      },
    );
  });
});

describe("withBackoff", () => {
  it("retries a NetworkError then succeeds", async () => {
    let calls = 0;
    const out = await withBackoff(
      async () => {
        calls += 1;
        if (calls < 2) throw new NetworkError("flaky");
        return "ok";
      },
      { baseDelayMs: 1 },
    );
    expect(out).toBe("ok");
    expect(calls).toBe(2);
  });

  it("does NOT retry a permanent error (AuthError)", async () => {
    let calls = 0;
    await expect(
      withBackoff(async () => {
        calls += 1;
        throw new AuthError("nope");
      }),
    ).rejects.toBeInstanceOf(AuthError);
    expect(calls).toBe(1);
  });

  it("gives up after maxAttempts and throws the last error", async () => {
    let calls = 0;
    await expect(
      withBackoff(
        async () => {
          calls += 1;
          throw new NetworkError("down");
        },
        { maxAttempts: 3, baseDelayMs: 1 },
      ),
    ).rejects.toBeInstanceOf(NetworkError);
    expect(calls).toBe(3);
  });
});
