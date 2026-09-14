/**
 * @file meta.routes.tsx
 * @module engage-mt/routes
 * @description AR-2 — Cross-cutting routes that don't belong to one module: the
 *              default map landing route (`/`), the About/Privacy/Attribution
 *              legal pages, and the `*` 404 catch-all. Consumed LAST by
 *              `useRoutes` in App.tsx so the catch-all sits at the end of the
 *              flattened table.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { RouteObject } from "react-router-dom";
import { lazyNamed } from "./lazyNamed";
// MapPage is the default landing route — eager-loaded (NOT via lazyNamed) so the
// first paint isn't gated by Suspense. Matches the App.tsx pre-AR-2 behavior.
import { MapPage } from "@/components/map/MapPage";
import { NotFoundPage } from "@/components/shared/pages/NotFoundPage";

const PrivacyPage = lazyNamed(() => import("@/components/shared/pages/PrivacyPage"), "PrivacyPage");
const AttributionPage = lazyNamed(
  () => import("@/components/shared/pages/AttributionPage"),
  "AttributionPage",
);
const AccessibilityStatementPage = lazyNamed(
  () => import("@/components/shared/pages/AccessibilityStatementPage"),
  "AccessibilityStatementPage",
);

export const metaRoutes: RouteObject[] = [
  { path: "/", element: <MapPage /> },
  // About / Privacy / Attribution.
  { path: "/privacy", element: <PrivacyPage /> },
  { path: "/accessibility", element: <AccessibilityStatementPage /> },
  { path: "/about/attribution", element: <AttributionPage /> },
  { path: "*", element: <NotFoundPage /> },
];
