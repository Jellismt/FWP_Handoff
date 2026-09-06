/**
 * @file main.tsx
 * @module engage-mt/shared
 * @description Application entry point. Registers Calcite custom elements (awaited so
 *              React never renders before they're defined), configures the ArcGIS asset
 *              path, and mounts the React tree under React Router.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.4.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import esriConfig from "@arcgis/core/config";
// @arcgis/core ships @ts-ignore for this module — no .d.ts emitted in 4.34.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — see comment above
import EsriLogger from "@arcgis/core/core/Logger";
import { version as ARCGIS_VERSION } from "@arcgis/core/kernel";
import IdentityManager from "@arcgis/core/identity/IdentityManager";
import { setAssetPath as setCalciteAssetPath } from "@esri/calcite-components/dist/components";
import { defineCustomElements as defineCalcite } from "@esri/calcite-components/dist/loader";
import "./styles/global.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/shared/feedback/ErrorBoundary";
import { createLogger } from "./utils/logger";

// CRITICAL: ArcGIS assetsPath MUST match the version of @arcgis/core actually
// loaded by Vite. If the CDN serves a different version, the renderer pipeline
// hangs forever — FeatureLayerViews stay `updating=true`, no geometry is
// fetched, and vector data layers (BMA, FAS, hunting districts) never draw
// pixels onto the canvas. Source the version from @arcgis/core/kernel so this
// can't silently drift again on upgrade.
const ARCGIS_VERSION_PATH = `https://js.arcgis.com/${ARCGIS_VERSION}/@arcgis/core/assets`;
// Calcite assets are copied locally from node_modules into web/public/calcite-assets/
// at postinstall (see web/scripts/copy-calcite-assets.mjs, pruned to the icon allowlist)
// so icons resolve offline too.
// Trailing slash matters: Calcite appends "icon/{name}{size}.json" directly.
const CALCITE_VERSION_PATH = "/calcite-assets/";

esriConfig.assetsPath = ARCGIS_VERSION_PATH;
setCalciteAssetPath(CALCITE_VERSION_PATH);

// Silence "[esri.Basemap] #load() Failed to load basemap" noise.
// The error fires when React StrictMode (or fast initial-load re-renders)
// tears down a MapView before its first basemap finishes loading. The
// replacement basemap on the surviving view loads normally, so the
// message is noise that masks real errors in the console. The Basemap
// logger is scoped narrowly to this one module.
EsriLogger.getLogger("esri.Basemap").level = "none";

// One-time HEAD check on boot. If the Calcite asset bundle isn't reachable, the entire
// UI renders as white squares (icon-only Calcite actions become empty). Surface that to
// the diagnostic logger for future debugging.
const log = createLogger("calcite-assets");
void fetch(`${CALCITE_VERSION_PATH}assets/icon/information16.json`, { method: "HEAD" })
  .then((res) => {
    if (!res.ok) {
      log.warn("Calcite asset bundle unreachable", {
        url: `${CALCITE_VERSION_PATH}assets/icon/information16.json`,
        status: res.status,
      });
    }
  })
  .catch((err: unknown) => {
    log.warn("Calcite asset HEAD check failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });

// Privacy + UX rule: never prompt the user for ArcGIS credentials. If a layer is
// token-gated and we don't carry an FWP session token yet, the layer should fail
// silently and surface as "Sign-in required" in the layer panel.
//
// Strategy is defense-in-depth — token-gated layers carry deferredLoad: true in
// the registry so they're never even added to the map; this interceptor is the
// secondary safety net.
const identityLogger = createLogger("identity-manager");
IdentityManager.on("dialog-create", (event: unknown) => {
  // ArcGIS's typings for this event are loose; cast through unknown so we can
  // poke at the dialog object without giving up our strict null checks.
  const wrapped = event as { dialog?: { destroy?: () => void; cancel?: () => void } };
  const dialog = wrapped?.dialog;
  // Preferred path: ask the dialog to tear itself down.
  if (dialog && typeof dialog.cancel === "function") {
    try {
      dialog.cancel();
      identityLogger.info("Cancelled ArcGIS sign-in dialog via cancel()");
      return;
    } catch (err) {
      identityLogger.warn("dialog.cancel() failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  if (dialog && typeof dialog.destroy === "function") {
    try {
      dialog.destroy();
      identityLogger.info("Destroyed ArcGIS sign-in dialog via destroy()");
      return;
    } catch (err) {
      identityLogger.warn("dialog.destroy() failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  // Last-resort fallback: pull the DOM node out. Runs async so Esri has had
  // a chance to actually attach the modal element.
  setTimeout(() => {
    const node = document.querySelector(".esri-identity-modal");
    if (node && node.parentElement) {
      node.parentElement.removeChild(node);
      identityLogger.info("Removed ArcGIS sign-in modal via DOM fallback");
    }
  }, 0);
});

// Global last-resort failure capture. The React <ErrorBoundary> only catches
// errors thrown during render/lifecycle; async rejections (a fetch that throws
// outside a try/catch, a fire-and-forget promise) and uncaught runtime errors
// would otherwise bypass the app's logger. Route them through it so they are
// visible in development and silent in production (per docs/rules/privacy.md).
// Never use raw console — no-console is an ESLint error and the logger is the
// single sanctioned sink.
if (typeof window !== "undefined") {
  const globalLog = createLogger("global");
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    globalLog.error("Unhandled promise rejection", {
      error: reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason),
    });
  });
  window.addEventListener("error", (event) => {
    globalLog.error("Uncaught error", {
      error:
        event.error instanceof Error
          ? `${event.error.name}: ${event.error.message}`
          : event.message,
      source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
    });
  });
}

// INF-015 — dev-only runtime accessibility check. `@axe-core/react` re-runs an
// axe-core audit after each React commit and logs WCAG violations to the
// console, so 508/WCAG regressions surface during development the moment they
// land. The dynamic import is gated behind `import.meta.env.DEV` so the axe
// payload never enters the production bundle (per docs/rules/accessibility.md
// + the privacy rule — dev-only, on-device, no telemetry).
if (import.meta.env.DEV && typeof window !== "undefined") {
  void (async () => {
    const [{ default: axe }, React, ReactDOM] = await Promise.all([
      import("@axe-core/react"),
      import("react"),
      import("react-dom"),
    ]);
    // 1000ms debounce — coalesce the audit across rapid commit bursts.
    await axe(React, ReactDOM, 1000);
  })();
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Engage MT could not mount: missing #root element in index.html");
}

// Register Calcite custom elements before React mounts. The loader returns void but
// `customElements.whenDefined` lets us await registration of a sentinel element to
// avoid the brief flash-of-undefined-element race (BUG-002).
defineCalcite(window);

const mount = (): void => {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary scope="app">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
};

window.customElements.whenDefined("calcite-shell").then(mount).catch(mount); // fall back to render anyway if Calcite never defines (test env)
