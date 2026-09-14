/**
 * @file field.routes.tsx
 * @module engage-mt/routes
 * @description AR-2 — Field-tools route table. Extracted from App.tsx. Includes
 *              the `/field/receive` share-receive deep-link target. Consumed by
 *              `useRoutes` in App.tsx.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { RouteObject } from "react-router-dom";
import { lazyNamed } from "./lazyNamed";

const FieldToolsPage = lazyNamed(
  () => import("@/components/field/FieldToolsPage"),
  "FieldToolsPage",
);
const OfflineTilesPage = lazyNamed(
  () => import("@/components/manage/OfflineTilesPage"),
  "OfflineTilesPage",
);
// Receive a high-fidelity pin-share link. Renders on both a native
// deep link (navigateTo) and a universal link opened cold in the browser (the
// router reads location.search).
const ReceiveSharePage = lazyNamed(
  () => import("@/components/field/ReceiveSharePage"),
  "ReceiveSharePage",
);

export const fieldRoutes: RouteObject[] = [
  { path: "/field", element: <FieldToolsPage /> },
  // OfflineTilesPage logically belongs in /field; /manage/offline-tiles
  // stays a permanent backwards-compatible alias (see manage.routes.tsx).
  { path: "/field/offline-maps", element: <OfflineTilesPage /> },
  { path: "/field/receive", element: <ReceiveSharePage /> },
];
