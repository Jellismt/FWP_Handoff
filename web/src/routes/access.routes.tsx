/**
 * @file access.routes.tsx
 * @module engage-mt/routes
 * @description AR-2 — Access-module route table. Extracted from App.tsx. Every
 *              entry is a code-split named-export via `lazyNamed`. Consumed by
 *              `useRoutes` in App.tsx.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Navigate, type RouteObject } from "react-router-dom";
import { lazyNamed } from "./lazyNamed";

const BmaDetail = lazyNamed(() => import("@/components/access/BmaDetail"), "BmaDetail");

export const accessRoutes: RouteObject[] = [
  // Explore + Access are one tab; the merged landing lives at /explore. The
  // redirects keep the pre-merge tab paths alive.
  { path: "/access", element: <Navigate to="/explore" replace /> },
  { path: "/access/bma/:id", element: <BmaDetail /> },
  { path: "/access/state-trust-land", element: <Navigate to="/?focus=mt-cadastral" replace /> },
];
