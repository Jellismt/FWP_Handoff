/**
 * @file index.ts
 * @module engage-mt/routes
 * @description AR-2 — the flattened route table App.tsx feeds to `useRoutes`.
 *              Per-module arrays concatenated in a fixed order; `metaRoutes`
 *              MUST come last because it owns the `*` 404 catch-all, which
 *              `useRoutes` ranks by specificity but which is clearest to keep
 *              physically last.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { RouteObject } from "react-router-dom";
import { huntRoutes } from "./hunt.routes";
import { exploreRoutes } from "./explore.routes";
import { accessRoutes } from "./access.routes";
import { manageRoutes } from "./manage.routes";
import { fieldRoutes } from "./field.routes";
import { metaRoutes } from "./meta.routes";

export const appRoutes: RouteObject[] = [
  ...huntRoutes,
  ...exploreRoutes,
  ...accessRoutes,
  ...manageRoutes,
  ...fieldRoutes,
  ...metaRoutes,
];
