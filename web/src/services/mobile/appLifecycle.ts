/**
 * @file appLifecycle.ts
 * @module engage-mt/services/mobile
 * @description Native app-lifecycle wiring for the Capacitor shell (@capacitor/app).
 *              Three behaviors that have no web equivalent:
 *
 *                1. Android hardware BACK button — without a handler, pressing
 *                   Back exits the app from any screen. We instead pop the
 *                   in-app router history and only exit at a tab root (Android
 *                   convention for top-level destinations).
 *                2. App RESUME — when the user returns from the background, re-
 *                   check time-sensitive state (connectivity + connectivity-sensitive
 *                   feed) that may have changed while suspended.
 *                3. Deep links (appUrlOpen) — route an inbound `engagemt://…`
 *                   custom-scheme URL or an `https://…/app/…` universal link
 *                   into React Router.
 *
 * the whole module is a no-op on the web target; the
 *              `@capacitor/app` plugin is dynamically imported only inside the
 *              Capacitor guard so it never enters the web bundle.
 *
 *              Privacy: no lifecycle event is transmitted. Deep-link parsing is
 *              pure-local. Per docs/rules/privacy.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-14
 * @version 1.1.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createLogger } from "@/utils/logger";
import { isCapacitor } from "@/utils/capacitor";
import { isExternalShareLink } from "@/services/field/shareLink";

const log = createLogger("app-lifecycle");

/**
 * Tab-root routes. Pressing the Android system Back button on one of these
 * exits the app (top-level destinations have nowhere "up" to go). Every other
 * route pops the router history instead. Mirrors MODULE_NAV paths + the map
 * landing route.
 */
export const ROOT_PATHS: readonly string[] = ["/", "/hunt", "/explore", "/manage"];

export type BackAction = "back" | "exit";

/**
 * Pure decision for the Android Back button. Exported for unit testing so the
 * branch logic is verified without a device. `canGoBack` is supplied by the
 * Capacitor `backButton` event and reflects the WebView history depth.
 */
export const resolveBackAction = (pathname: string, canGoBack: boolean): BackAction => {
  const atRoot = ROOT_PATHS.includes(pathname);
  // Deep, in-app screen with history behind it → walk back one step.
  if (!atRoot && canGoBack) return "back";
  // A tab root, or a screen we landed on directly (deep link / no history) →
  // let the OS background the app.
  return "exit";
};

/**
 * Translate an inbound deep-link URL to an in-app router path, or `null` when
 * the URL isn't one of ours. Pure + exported for unit testing.
 *
 * Accepts:
 *   - custom scheme:   `engagemt://hunt/districts`   → `/hunt/districts`
 *   - custom scheme:   `engagemt://`                  → `/`
 *   - universal link:  `https://fwp.mt.gov/app/fish`  → `/fish`
 *                      (an optional `/app` base is stripped)
 */
export const deepLinkToPath = (url: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol === "engagemt:") {
    // For a custom scheme, the first path segment lands in `host`.
    const combined = `/${parsed.host}${parsed.pathname}`.replace(/\/{2,}/g, "/");
    const trimmed = combined.replace(/\/+$/, "");
    return `${trimmed || "/"}${parsed.search}`;
  }

  if (parsed.protocol === "https:" || parsed.protocol === "http:") {
    const path = parsed.pathname.replace(/^\/app(?=\/|$)/, "") || "/";
    return `${path}${parsed.search}`;
  }

  return null;
};

/** How an inbound launch/open URL should be handled. */
export type LaunchUrlKind = "deep-link" | "share-file" | "external-guidance" | "unknown";

/**
 * Classify an inbound URL from `appUrlOpen` / `getLaunchUrl`. Pure + exported
 * for unit testing.
 *
 *   - `file:` / `content:` → a GPX/KML file the OS handed us.
 *   - an external http(s) host → a link locked to another app → route to guidance.
 *   - a recognized app URL  → a normal deep / universal link.
 *   - anything else         → ignore.
 *
 * The external-link test runs before the deep-link test so a foreign
 * `https://…` link never falls through and mis-navigates to a bogus in-app path.
 */
export const classifyLaunchUrl = (url: string): LaunchUrlKind => {
  if (/^(file|content):/i.test(url)) return "share-file";
  if (isExternalShareLink(url)) return "external-guidance";
  if (deepLinkToPath(url) != null) return "deep-link";
  return "unknown";
};

export interface AppLifecycleHandlers {
  /** Current router pathname. A getter (not a value) so the Back handler always
   *  reads the live route rather than a stale closure. */
  getPathname: () => string;
  /** Pop router history one step (e.g. `() => navigate(-1)`). */
  goBack: () => void;
  /** Navigate to an absolute in-app path (deep-link target). */
  navigateTo: (path: string) => void;
  /** Optional: called when the app returns to the foreground. */
  onResume?: () => void;
  /** Optional: a GPX/KML file (file:// or content:// URI) was opened via the
   *  OS share sheet / Files app. The implementer reads + parses it. */
  onSharedFile?: (uri: string) => void;
}

let installed = false;

interface PluginListenerHandle {
  remove: () => Promise<void> | void;
}

interface CapacitorAppPlugin {
  exitApp: () => Promise<void>;
  getLaunchUrl: () => Promise<{ url: string } | null>;
  addListener: (
    event: "backButton" | "resume" | "appUrlOpen",
    cb: (data: { canGoBack?: boolean; url?: string }) => void,
  ) => Promise<PluginListenerHandle>;
}

/**
 * Route a single inbound URL (from a live `appUrlOpen` or a cold-start
 * `getLaunchUrl`) to the right handler. Shared so both entry points behave
 * identically.
 */
const routeLaunchUrl = (url: string, handlers: AppLifecycleHandlers): void => {
  switch (classifyLaunchUrl(url)) {
    case "share-file":
      handlers.onSharedFile?.(url);
      break;
    case "external-guidance":
      // Land on the receive page's guidance state (no `?d=` → "this link is from
      // another app" copy pointing the user at Export → GPX/KML).
      handlers.navigateTo("/field/receive");
      break;
    case "deep-link": {
      const path = deepLinkToPath(url);
      if (path) handlers.navigateTo(path);
      break;
    }
    default:
      log.info("Ignored unrecognized launch URL", { url });
  }
};

/**
 * Wire the native app-lifecycle listeners. Idempotent — calling twice is a
 * no-op. No-op on web. Returns a teardown function (used by tests + HMR);
 * production callers can ignore the return.
 */
export const installAppLifecycle = (handlers: AppLifecycleHandlers): (() => void) => {
  if (!isCapacitor()) return () => undefined;
  if (installed) return () => undefined;
  installed = true;

  const teardowns: Array<() => void> = [];

  void (async () => {
    try {
      // Literal dynamic import so Vite bundles @capacitor/app into a lazy chunk
      // that resolves in the native WebView. A `@vite-ignore`'d *variable* import
      // leaves a bare specifier the WebView can't resolve at runtime — the import
      // throws, the catch below swallows it, and the lifecycle listeners silently
      // never attach (back button / resume / deep links all dead). The chunk is
      // only fetched inside this isCapacitor() guard, so it never loads on web.
      const { App } = (await import("@capacitor/app")) as unknown as {
        App: CapacitorAppPlugin;
      };

      // 1. Android hardware Back button (fires on Android only).
      const backHandle = await App.addListener("backButton", ({ canGoBack }) => {
        const action = resolveBackAction(handlers.getPathname(), Boolean(canGoBack));
        if (action === "back") {
          handlers.goBack();
        } else {
          void App.exitApp();
        }
      });
      teardowns.push(() => void backHandle.remove());

      // 2. Resume from background — refresh time-sensitive state.
      const resumeHandle = await App.addListener("resume", () => {
        handlers.onResume?.();
      });
      teardowns.push(() => void resumeHandle.remove());

      // 3. Deep links + shared-file opens (live, while running).
      const urlHandle = await App.addListener("appUrlOpen", ({ url }) => {
        if (url) routeLaunchUrl(url, handlers);
      });
      teardowns.push(() => void urlHandle.remove());

      // 3b. Cold-start launch URL — when the app was NOT already running and
      // the OS opened it via a deep link / shared file, `appUrlOpen` may have
      // fired before our listener attached. `getLaunchUrl` recovers it.
      try {
        const launch = await App.getLaunchUrl();
        if (launch?.url) routeLaunchUrl(launch.url, handlers);
      } catch {
        /* getLaunchUrl unsupported on some platforms — safe to ignore */
      }

      log.info("App lifecycle listeners installed");
    } catch (err) {
      log.warn("Failed to install app lifecycle listeners", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();

  return () => {
    teardowns.forEach((fn) => fn());
    installed = false;
  };
};
