/**
 * @file createWaypoint.ts
 * @module engage-mt/services/field
 * @description The one place a waypoint is created from a map point.
 *              Extracted from attachWaypointDrop so the long-press/right-click
 *              gesture AND the tap-query "Drop a waypoint here" action share
 *              identical creation semantics (timestamp default name, active-trip
 *              assignment, edit-mode open) and can't drift. View-free so a caller
 *              without the MapView in scope (the tap panel) can use it too.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useFieldToolsStore, type Waypoint } from "@/store/field/fieldToolsStore";
import type { TapQueryResult } from "@/components/map/TapQueryPanel";

/**
 * Create + persist a draft waypoint at a lat/lon and mark it as the freshly
 * created pin (so its FeatureCard opens in edit mode). Returns the Waypoint.
 */
export const createWaypointAt = ({ lat, lon }: { lat: number; lon: number }): Waypoint => {
  const tools = useFieldToolsStore.getState();
  // Timestamp default (HH:MM) so multiple drops in one day stay distinguishable
  // in the Field Tools list before the user renames.
  const stamp = new Date()
    .toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
    .replace(/^0/, "");
  const wp = tools.addWaypoint({
    kind: "general",
    name: `Waypoint ${stamp}`,
    lat,
    lon,
    tripId: tools.activeTripId ?? undefined,
  });
  tools.setLastCreated(wp.id);
  return wp;
};

/**
 * Shape a just-created waypoint into the FeatureCard-pipeline result the map
 * emit path expects (used by attachWaypointDrop's gesture flow).
 */
export const waypointCardResult = (wp: Waypoint): TapQueryResult => ({
  layerId: "engage-mt-field-waypoint",
  layerTitle: "Waypoint",
  module: "shared",
  features: [
    {
      __feature_kind: "waypoint",
      id: wp.id,
      name: wp.name,
      kind: wp.kind,
      lat: wp.lat,
      lon: wp.lon,
      notes: "",
      createdAt: wp.createdAt,
      updatedAt: wp.updatedAt,
      photoUri: "",
    },
  ],
});
