/**
 * @file attachWaypointDrop.ts
 * @module engage-mt/map
 * @description Long-press / right-click "drop a waypoint here" wiring,
 *              extracted from MapView.tsx. Attaches the
 *              ArcGIS `hold` event (canonical mobile long-press) and a desktop
 *              `contextmenu` bridge (right-click), both producing the same
 *              outcome: a draft waypoint dropped at the press point + its
 *              FeatureCard auto-opened in edit mode. Returns a detach function
 *              that removes both listeners — same imperative pattern as
 *              `attachFieldGraphics` / `attachMontanaBoundaryMask`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { TapPoint } from "@/types/featureCard";
import { useMapInteractionStore } from "@/store/map/mapInteractionStore";
import { createWaypointAt, waypointCardResult } from "@/services/field/createWaypoint";
import type { TapQueryResult } from "./TapQueryPanel";
import { pulseAtPoint } from "./selectionPulse";
import { toTapPoint } from "./tapQuery/toTapPoint";

export interface WaypointDropParams {
  view: __esri.MapView;
  /** Forwards the just-dropped waypoint through the FeatureCard pipeline. */
  emit: (results: TapQueryResult[], tapPoint: TapPoint | null) => void;
}

/**
 * Wire long-press + right-click waypoint dropping onto a view. Returns a detach
 * that removes the `hold` handle and the `contextmenu` listener.
 */
export function attachWaypointDrop({ view, emit }: WaypointDropParams): () => void {
  // Shared handler for both the ArcGIS `hold` event and the desktop
  // `contextmenu` bridge. Both drop a waypoint + auto-open its FeatureCard.
  const dropWaypointAtMapPoint = (mapPoint: __esri.Point): void => {
    if (useMapInteractionStore.getState().activeTool !== "none") return;
    if (mapPoint.latitude == null || mapPoint.longitude == null) return;
    // Creation semantics live in the shared createWaypointAt helper so
    // this gesture and the tap-panel "Drop a waypoint here" action never drift.
    const wp = createWaypointAt({ lat: mapPoint.latitude, lon: mapPoint.longitude });
    pulseAtPoint(view, mapPoint);
    // Surface the waypoint via the FeatureCard pipeline so the user can rename
    // + categorize inline. The graphic appears within the same store tick.
    emit([waypointCardResult(wp)], toTapPoint(mapPoint));
  };

  const holdHandle = view.on("hold", (event) => {
    if (event.mapPoint) dropWaypointAtMapPoint(event.mapPoint);
  });

  // Desktop equivalent. Right-click feels like "drop a marker here";
  // preventing the browser context menu is intentional — the map IS the context.
  const onContextMenu = (e: MouseEvent): void => {
    if (useMapInteractionStore.getState().activeTool !== "none") return;
    const containerEl = view.container as HTMLElement | null;
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const mapPoint = view.toMap(screenPoint);
    if (!mapPoint) return;
    e.preventDefault();
    dropWaypointAtMapPoint(mapPoint);
  };
  const viewContainer = view.container as HTMLElement | null;
  viewContainer?.addEventListener("contextmenu", onContextMenu);

  return () => {
    holdHandle.remove();
    viewContainer?.removeEventListener("contextmenu", onContextMenu);
  };
}
