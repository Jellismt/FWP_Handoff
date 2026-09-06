/**
 * @file gageSourceDispatch.ts
 * @module engage-mt/services/hydrology
 * @description Decides which live-data source a tapped gage graphic belongs
 *              to. USGS graphics are stamped `source: "usgs"` by
 *              `usgsGagesLayer.ts`; DNRC StAGE features (MapServer/0) carry a
 *              `LocationCode`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export type GageSource = "usgs" | "dnrc";

export const detectSource = (attrs: Record<string, unknown>): GageSource => {
  if (typeof attrs.source === "string" && attrs.source.toLowerCase() === "dnrc") return "dnrc";
  if (typeof attrs.source === "string" && attrs.source.toLowerCase() === "usgs") return "usgs";
  return "LocationCode" in attrs ? "dnrc" : "usgs";
};
