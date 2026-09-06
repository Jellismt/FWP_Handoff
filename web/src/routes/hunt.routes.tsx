/**
 * @file hunt.routes.tsx
 * @module engage-mt/routes
 * @description AR-2 — Hunt-module route table. Extracted from App.tsx so route
 *              churn lands in the owning module's file instead of one contested
 *              root component. Every entry is a code-split named-export via
 *              `lazyNamed`. Consumed by `useRoutes` in App.tsx.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-15
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { type RouteObject } from "react-router-dom";
import { lazyNamed } from "./lazyNamed";

// Hunt carries the district browser + API-fed district reports.
const HuntPage = lazyNamed(() => import("@/components/hunt/HuntPage"), "HuntPage");
const DistrictDetail = lazyNamed(
  () => import("@/components/hunt/DistrictDetail"),
  "DistrictDetail",
);
const HuntingDistrictsBrowser = lazyNamed(
  () => import("@/components/hunt/HuntingDistrictsBrowser"),
  "HuntingDistrictsBrowser",
);

export const huntRoutes: RouteObject[] = [
  { path: "/hunt", element: <HuntPage /> },
  { path: "/hunt/districts", element: <HuntingDistrictsBrowser /> },
  { path: "/hunt/district/:district", element: <DistrictDetail /> },
];
