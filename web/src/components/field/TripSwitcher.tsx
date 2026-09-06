/**
 * @file TripSwitcher.tsx
 * @module engage-mt/field
 * @description Trip / folder switcher for the FieldToolsPage.
 *              Renders a horizontal pill row of the user's trips with a
 *              leading "All" pill that clears the filter. Trips arrive as
 *              shared bundles — when none exist the switcher
 *              renders nothing. The active trip drives the visible item
 *              list everywhere in the field-tools surface (waypoints list,
 *              tracks list, shapes list, GPX export). Trip color comes
 *              from the brand token map so trip pills inherit light/dark
 *              theme flips.
 *
 *              Per [docs/rules/design-polish.md](../../../docs/rules/design-polish.md)
 *              every interactive control is built on `PillButton` so the
 *              field-tools UI matches the rest of the product chrome.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Archive, Tag } from "lucide-react";
import { useFieldToolsStore, WAYPOINT_COLOR_VAR } from "@/store/field/fieldToolsStore";
import "./TripSwitcher.css";

export const TripSwitcher = (): JSX.Element | null => {
  const trips = useFieldToolsStore((s) => s.trips);
  const activeTripId = useFieldToolsStore((s) => s.activeTripId);
  const setActiveTrip = useFieldToolsStore((s) => s.setActiveTrip);
  const archiveTrip = useFieldToolsStore((s) => s.archiveTrip);

  const activeTrips = trips.filter((t) => !t.archivedAt);
  if (activeTrips.length === 0) return null;

  return (
    <div className="trip-switcher">
      <div className="trip-switcher__row" role="tablist" aria-label="Trips">
        <button
          type="button"
          role="tab"
          aria-selected={activeTripId === null}
          className={`trip-switcher__pill${activeTripId === null ? " trip-switcher__pill--on" : ""}`}
          onClick={() => setActiveTrip(null)}
        >
          All
        </button>
        {activeTrips.map((t) => {
          const selected = t.id === activeTripId;
          return (
            <div key={t.id} className="trip-switcher__cell">
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                className={`trip-switcher__pill${selected ? " trip-switcher__pill--on" : ""}`}
                style={{ "--trip-accent": WAYPOINT_COLOR_VAR[t.color] } as React.CSSProperties}
                onClick={() => setActiveTrip(t.id)}
              >
                <Tag size={12} aria-hidden />
                {t.name}
              </button>
              {selected && (
                <button
                  type="button"
                  className="trip-switcher__archive"
                  aria-label={`Archive trip ${t.name}`}
                  onClick={() => {
                    if (window.confirm(`Archive trip "${t.name}"? Items will be unassigned.`)) {
                      archiveTrip(t.id);
                      setActiveTrip(null);
                    }
                  }}
                >
                  <Archive size={12} aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
