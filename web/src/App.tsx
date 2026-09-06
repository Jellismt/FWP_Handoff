/**
 * @file App.tsx
 * @module engage-mt/shared
 * @description Root component. Owns the responsive layout shell (header + sidebar/tab-bar),
 *              the app-wide bootstrap effects, and renders the matched route via
 *              `useRoutes(appRoutes)`. The route table itself lives in per-module
 *              files under `src/routes/` so route churn stays out of
 *              this one contested file. Focus moves to <main> on route change so SR
 *              users hear a page-change cue. Routes are code-split via
 *              React.lazy + Suspense.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-04
 * @version 1.5.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { lazy, Suspense, useEffect, useRef } from "react";
import { useLocation, useNavigate, useRoutes } from "react-router-dom";
import { CalciteLoader } from "@esri/calcite-components-react";
import { AppHeader } from "@/components/shared/layout/AppHeader";
import { OfflineBanner } from "@/components/shared/notices/OfflineBanner";
import "@/components/shared/notices/OfflineBanner.css";
import { appRoutes } from "@/routes";
import { Sidebar } from "@/components/shared/layout/Sidebar";
import { BottomTabBar } from "@/components/shared/layout/BottomTabBar";
import { ErrorBoundary } from "@/components/shared/feedback/ErrorBoundary";
import { ToastViewport } from "@/components/shared/notices/ToastViewport";
import { TipMontPortal } from "@/components/shared/tipMont";
import { useTakeoverPopupStore } from "@/store/map/takeoverPopupStore";
import { useTheme } from "@/hooks/useTheme";
import { registerPrefetchRoutes } from "@/routes/prefetch";
import { useFieldModeStore } from "@/store/field/fieldModeStore";
import { installConnectivityListeners } from "@/store/app/connectivityStore";
import { useOfflineAreasStore } from "@/store/field/offlineAreasStore";
import { installAppLifecycle } from "@/services/mobile/appLifecycle";
import { stageSharedFileImport } from "@/services/field/sharedFileImport";
import { initNativeChrome, hideSplash } from "@/services/mobile/nativeChrome";
import "./App.css";

// The takeover portal statically pulls in the entire FeatureCard
// registry (every Tier-2 card + chart + hydro primitive). It's mounted on
// every route, so eager-loading it bloated the main chunk even on routes that
// never open a feature (Manage, settings, …). Defer that chunk until the user
// first expands a feature; see LazyTakeoverPortal below.
const TakeoverPopupPortal = lazy(() =>
  import("@/components/shared/overlays/TakeoverPopupPortal").then((m) => ({
    default: m.TakeoverPopupPortal,
  })),
);

/**
 * Mounts the takeover portal only after a feature has been opened. The store's
 * `layerId` latches non-null on the first openFeature() and stays set through
 * close (the portal relies on that for its exit animation + reuse), so this
 * mounts exactly once and survives subsequent opens — the FeatureCard chunk
 * loads on that first expand and is cached thereafter.
 */
const LazyTakeoverPortal = (): JSX.Element | null => {
  const requested = useTakeoverPopupStore((s) => s.layerId !== null);
  if (!requested) return null;
  return (
    <Suspense fallback={null}>
      <TakeoverPopupPortal />
    </Suspense>
  );
};

// Prefetch-on-intent: when the user hovers or focuses a link to a registered
// route, its chunk starts loading so the navigation feels instant. The browser
// deduplicates concurrent and already-resolved imports of the same specifier.
registerPrefetchRoutes();

const RouteSuspense = (): JSX.Element => (
  <div className="route-suspense" aria-busy="true">
    <CalciteLoader scale="m" label="Loading…" />
  </div>
);

export const App = (): JSX.Element => {
  useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement | null>(null);
  const fieldActive = useFieldModeStore((s) => s.active);

  // AR-2 — the route table lives in per-module files under src/routes/; App.tsx
  // just renders the matched element inside the shared ErrorBoundary + Suspense.
  const routeElement = useRoutes(appRoutes);

  // Live pathname for the native Back handler. A ref (updated every render)
  // keeps the @capacitor/app listener — installed once — reading the current
  // route instead of a stale closure from first mount.
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  // Move focus to <main> when the route changes so screen readers announce
  // the new page. The initial load is left alone: focus stays at the top of
  // the document so the first Tab press lands on the skip link.
  const initialPathRef = useRef(true);
  useEffect(() => {
    if (initialPathRef.current) {
      initialPathRef.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [location.pathname]);

  // Field mode → body[data-field-mode="true"]; CSS in App.css elevates locate-me,
  // increases tap targets, and dims ancillary chrome.
  useEffect(() => {
    document.body.dataset.fieldMode = fieldActive ? "true" : "false";
    return () => {
      delete document.body.dataset.fieldMode;
    };
  }, [fieldActive]);

  // M1 — native window chrome (status bar + splash). Configure the status bar
  // and dismiss the launch splash once React has painted. No-op on web.
  useEffect(() => {
    void initNativeChrome();
    void hideSplash();
  }, []);

  // M1 — native app-lifecycle listeners (@capacitor/app): Android Back button,
  // resume-from-background handling, and deep links. No-op on web. Installed
  // once; the Back handler reads the live route via pathnameRef.
  useEffect(() => {
    const teardown = installAppLifecycle({
      getPathname: () => pathnameRef.current,
      goBack: () => navigate(-1),
      navigateTo: (path) => navigate(path),
      // A GPX/KML file opened from the OS share sheet / Files app.
      // Read + parse it, then land on Field Tools where the import preview opens.
      onSharedFile: (uri) => {
        void stageSharedFileImport(uri).then((staged) => {
          if (staged) navigate("/field");
        });
      },
    });
    return teardown;
  }, [navigate]);

  // Wire connectivity listeners. Web uses navigator.onLine;
  // Capacitor dynamically imports @capacitor/network on top for richer info.
  // Reconcile the offline-area index with the files on disk (device only).
  useEffect(() => {
    void useOfflineAreasStore.getState().hydrate();
  }, []);

  useEffect(() => {
    const teardown = installConnectivityListeners();
    return teardown;
  }, []);

  return (
    <>
      {/* Skip-to-content link. First focusable element on the
          page. Hidden until focused; reveals on Tab from page load. WCAG
          2.4.1 bypass-blocks. Wrapped in a nav landmark so every node on the
          page lives inside a landmark (axe `region`); the link itself is
          position:absolute, so the wrapper adds no layout. */}
      <nav aria-label="Skip navigation">
        <a href="#main" className="fwp-skip-link">
          Skip to main content
        </a>
      </nav>
      <AppHeader />
      <OfflineBanner />
      <div className="app-shell">
        <Sidebar />
        <main id="main" ref={mainRef} className="app-shell__main" tabIndex={-1}>
          <ErrorBoundary scope="route">
            <Suspense fallback={<RouteSuspense />}>{routeElement}</Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <BottomTabBar />
      <ToastViewport />
      <LazyTakeoverPortal />
      <TipMontPortal />
    </>
  );
};
