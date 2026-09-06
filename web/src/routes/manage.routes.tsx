/**
 * @file manage.routes.tsx
 * @module engage-mt/routes
 * @description AR-2 — My FWP route table. One simple landing (wallet listing +
 *              device cards) plus the device pages (My Device, Offline Maps,
 *              Field Tools). Consumed by `useRoutes` in App.tsx.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { isCapacitor } from "@/utils/capacitor";
import { lazyNamed } from "./lazyNamed";

const ManagePage = lazyNamed(() => import("@/components/manage/ManagePage"), "ManagePage");
const OfflineTilesPage = lazyNamed(
  () => import("@/components/manage/OfflineTilesPage"),
  "OfflineTilesPage",
);
const MyDevicePage = lazyNamed(() => import("@/components/manage/MyDevicePage"), "MyDevicePage");
// FieldToolsPage lives under /field but is aliased at /manage/field-tools.
const FieldToolsPage = lazyNamed(
  () => import("@/components/field/FieldToolsPage"),
  "FieldToolsPage",
);

export const manageRoutes: RouteObject[] = [
  { path: "/manage", element: <ManagePage /> },
  // My Device (the on-device data catalog) is a mobile-app surface; on the
  // web its path lands back on /manage. Field Tools stays on both platforms.
  {
    path: "/manage/my-device",
    element: isCapacitor() ? <MyDevicePage /> : <Navigate to="/manage" replace />,
  },
  { path: "/manage/offline-tiles", element: <OfflineTilesPage /> },
  { path: "/manage/field-tools", element: <FieldToolsPage /> },
];
