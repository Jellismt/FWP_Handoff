/**
 * @file explore.routes.tsx
 * @module engage-mt/routes
 * @description AR-2 — Explore-module route table. Extracted from App.tsx. Every
 *              entry is a code-split named-export via `lazyNamed`. Consumed by
 *              `useRoutes` in App.tsx.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Navigate, type RouteObject } from "react-router-dom";
import { lazyNamed } from "./lazyNamed";

// The merged "Explore & Access" landing serves one tab; both module ids stay intact.
const ExploreAccessPage = lazyNamed(
  () => import("@/components/explore/ExploreAccessPage"),
  "ExploreAccessPage",
);
const WmaDetail = lazyNamed(() => import("@/components/explore/WmaDetail"), "WmaDetail");
const StateParkDetail = lazyNamed(
  () => import("@/components/explore/StateParkDetail"),
  "StateParkDetail",
);

export const exploreRoutes: RouteObject[] = [
  { path: "/explore", element: <ExploreAccessPage /> },
  // Pre-merge tab path — Fishing Access Sites now lives on this tab.
  { path: "/fish", element: <Navigate to="/explore" replace /> },
  { path: "/explore/wma/:id", element: <WmaDetail /> },
  { path: "/explore/park/:id", element: <StateParkDetail /> },
];
