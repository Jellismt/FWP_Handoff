/**
 * @file DistrictDetail.tsx
 * @module engage-mt/hunt
 * @description Hunting district detail route.
 *              promoted from a 122-line linear page into a hero-driven,
 *              tabbed page hosted by `DistrictDetailTabs`. The route
 *              entry stays here for back-compatibility with every link
 *              and bookmark that already targets `/hunt/district/:id`.
 *
 *              See `DistrictDetailTabs.tsx` for the full tab structure
 *              and `HuntingDistrictsBrowser.tsx` for the new browse-
 *              first entry point at `/hunt/districts`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-06-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { DistrictDetailTabs } from "./DistrictDetailTabs";

export const DistrictDetail = (): JSX.Element => <DistrictDetailTabs />;
