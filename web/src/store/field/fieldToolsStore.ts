/**
 * @file fieldToolsStore.ts
 * @module engage-mt/store
 * @description Tier-3 store for consumer-grade mobile field tools — waypoints,
 *              drawn shapes, measurements, captured routes, and photo+note
 *              annotations. Everything is local-first and persisted via the
 *              shared `createPersistedKey` adapter (localStorage on web,
 * @capacitor/preferences on Capacitor — see).
 *
 *              Waypoint type extended with `color` (brand-token
 *              name), `photos` array (replaces the deprecated single
 *              `photoUri`), `tags`, `tripId`, `accuracyAtCapture`,
 *. Persist version bumped to 2; the
 *              migration shim lifts the legacy `photoUri` into `photos[0]`
 *              and back-fills empty `tags`/`color` defaults so existing
 *              users don't lose data.
 *
 *              No coordinates leave the device per the privacy rule.
 *              Export to GPX / share-sheet remains user-initiated.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-14
 * @version 2.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { platformStorage } from "@/store/capacitorPreferencesStorage";

/** Waypoint categories. Affects icon + color in map symbology. */
export type WaypointKind =
  | "general"
  | "camp"
  | "kill-site"
  | "trail-cam"
  | "blind"
  | "spring"
  | "glassing-point"
  | "rub"
  | "scrape"
  | "scat"
  | "tracks"
  | "hazard"
  | "vehicle"
  | "photo"
  | "ridge"
  | "saddle"
  | "water"
  | "feeding"
  | "bedding";

/**
 * Brand-token color name for waypoint accent. Stored as a semantic name so
 * the runtime can resolve it through `WAYPOINT_COLOR_VAR` against the live
 * brand-tokens CSS (light/dark mode flip is automatic). Per
 * [docs/rules/fwp-brand.md](../../docs/rules/fwp-brand.md) zero
 * raw hex in the type system.
 */
export type WaypointColorName =
  | "blue"
  | "green"
  | "orange"
  | "yellow"
  | "red"
  | "brown"
  | "flow"
  | "temp"
  | "fire"
  | "fish"
  | "park"
  | "snow"
  | "wind"
  | "elev"
  | "drought"
  | "mercury"
  | "wildlife";

/** Maps the stored `WaypointColorName` to a CSS var consumed by graphics + UI. */
export const WAYPOINT_COLOR_VAR: Record<WaypointColorName, string> = {
  blue: "var(--fwp-blue)",
  green: "var(--fwp-green-dark)",
  orange: "var(--fwp-orange)",
  yellow: "var(--fwp-yellow)",
  red: "var(--fwp-red)",
  brown: "var(--fwp-brown-raw)",
  flow: "var(--fwp-domain-flow)",
  temp: "var(--fwp-domain-temp)",
  fire: "var(--fwp-domain-fire)",
  fish: "var(--fwp-domain-fish)",
  park: "var(--fwp-domain-park)",
  snow: "var(--fwp-domain-snow)",
  wind: "var(--fwp-domain-wind)",
  elev: "var(--fwp-domain-elev)",
  drought: "var(--fwp-domain-drought)",
  mercury: "var(--fwp-domain-mercury)",
  wildlife: "var(--fwp-domain-wildlife)",
};

export interface WaypointPhoto {
  id: string;
  /** Data-URL on web, `file://...` filesystem URI on Capacitor. */
  uri: string;
  /** Optional 256px-square thumbnail data-URL — generated on capture. */
  thumbUri?: string;
  /** ISO capture timestamp. */
  capturedAt: string;
  /** GPS horizontal accuracy at capture (meters), when available. */
  accuracyM?: number;
}

export interface Waypoint {
  id: string;
  kind: WaypointKind;
  /** User-supplied label. */
  name: string;
  /** Optional longer note. */
  notes?: string;
  lat: number;
  lon: number;
  /** ISO timestamp the waypoint was created on-device. */
  createdAt: string;
  /** Last edit time. */
  updatedAt: string;
  /**
   * Brand-token color override. When unset, the kind's default color (from
   * `WAYPOINT_KIND_INFO`) drives the marker accent.
   */
  color?: WaypointColorName;
  /** Attached photos (multi). Replaces the deprecated `photoUri`. */
  photos: WaypointPhoto[];
  /** Free-form tag list for classification. Always present; may be empty. */
  tags: string[];
  /** Assigned trip / folder id. */
  tripId?: string;
  /** Horizontal accuracy of the GPS fix at creation (meters). */
  accuracyAtCapture?: number;
  /**
   * @deprecated Use `photos`. Retained on the type until a future schema
   * migration garbage-collects it from persisted rows; readers should not
   * trust it after v2.
   */
  photoUri?: string;
}

/** Polyline track with optional speed/elevation samples per node. */
export interface CapturedRoute {
  id: string;
  name: string;
  notes?: string;
  /** Densified [lon, lat] sample array. */
  path: Array<[number, number]>;
  /** Elevation sample (ft) at each node, if available. */
  elevationFt?: number[];
  /**
   * Start index of each continuous segment of `path`. A new segment begins
   * after a recording gap (pause, lock, lost fix), so the line is not drawn
   * straight across the gap. Absent means one segment from index 0.
   */
  segments?: number[];
  /** Median horizontal accuracy (m) of the fixes that made the track. */
  accuracyMedianM?: number;
  /** Total distance (miles) — computed at save time. */
  distanceMi: number;
  /** Total elevation gain (ft) — computed at save time. */
  gainFt: number;
  /** ISO start/end timestamps. */
  startedAt: string;
  endedAt: string;
  /** Assigned trip id. */
  tripId?: string;
  /** Free-form tags. */
  tags?: string[];
}

/** Free-hand polygon or polyline annotation the user drew on the map. */
export interface DrawnShape {
  id: string;
  name: string;
  shape: "polygon" | "polyline" | "rectangle" | "circle";
  /** Vertices [lon, lat]. For circle: [center, edge-point]. */
  vertices: Array<[number, number]>;
  /** Display color from the brand palette. */
  color: "red" | "orange" | "yellow" | "green" | "blue" | "purple";
  notes?: string;
  createdAt: string;
  /** Assigned trip id. */
  tripId?: string;
  /** Free-form tags. */
  tags?: string[];
}

/** One-shot measurement (line distance or polygon area). */
export interface Measurement {
  id: string;
  kind: "distance" | "area";
  vertices: Array<[number, number]>;
  /** Distance in miles OR area in acres depending on `kind`. */
  value: number;
  createdAt: string;
}

/** Named group / folder that waypoints + tracks + shapes belong to. */
export interface Trip {
  id: string;
  name: string;
  /** Brand-token color name for the trip pill. */
  color: WaypointColorName;
  /** Lucide icon name (free string — resolved at render time). */
  icon?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp when archived, or undefined if active. */
  archivedAt?: string;
}

interface FieldToolsState {
  waypoints: Waypoint[];
  routes: CapturedRoute[];
  shapes: DrawnShape[];
  measurements: Measurement[];
  trips: Trip[];

  /**
   * Id of the most recently-created field item. The map-driven
   * long-press flow sets this so the FeatureCard can open in edit mode
   * immediately ("you just dropped a pin, type a name"). Cards clear it
   * on first observation via `consumeLastCreated()`.
   */
  lastCreatedId: string | null;

  /** Currently-active trip filter (null = "All trips"). */
  activeTripId: string | null;

  // ── Mutations ──────────────────────────────────────────────────
  addWaypoint: (
    w: Omit<Waypoint, "id" | "createdAt" | "updatedAt" | "photos" | "tags"> &
      Partial<Pick<Waypoint, "id" | "createdAt" | "updatedAt" | "photos" | "tags">>,
  ) => Waypoint;
  updateWaypoint: (id: string, patch: Partial<Waypoint>) => void;
  removeWaypoint: (id: string) => void;
  /**
   * Add a single photo to an existing waypoint. `id` is optional: callers that
   * persist the photo to the filesystem first (see `services/field/waypointPhotos`)
   * pre-generate the id so the same id names the on-disk file; when omitted a
   * fresh id is minted.
   */
  addWaypointPhoto: (
    waypointId: string,
    photo: Omit<WaypointPhoto, "id"> & { id?: string },
  ) => void;
  /** Remove a single photo from a waypoint by photo id. */
  removeWaypointPhoto: (waypointId: string, photoId: string) => void;

  addRoute: (r: Omit<CapturedRoute, "id"> & Partial<Pick<CapturedRoute, "id">>) => CapturedRoute;
  updateRoute: (id: string, patch: Partial<CapturedRoute>) => void;
  removeRoute: (id: string) => void;

  addShape: (
    s: Omit<DrawnShape, "id" | "createdAt"> & Partial<Pick<DrawnShape, "id" | "createdAt">>,
  ) => DrawnShape;
  updateShape: (id: string, patch: Partial<DrawnShape>) => void;
  removeShape: (id: string) => void;

  addMeasurement: (
    m: Omit<Measurement, "id" | "createdAt"> & Partial<Pick<Measurement, "id" | "createdAt">>,
  ) => Measurement;
  removeMeasurement: (id: string) => void;

  // Trips
  addTrip: (
    t: Omit<Trip, "id" | "createdAt" | "updatedAt"> &
      Partial<Pick<Trip, "id" | "createdAt" | "updatedAt">>,
  ) => Trip;
  updateTrip: (id: string, patch: Partial<Trip>) => void;
  archiveTrip: (id: string) => void;
  removeTrip: (id: string) => void;
  setActiveTrip: (id: string | null) => void;
  /** Bulk-assign field items to a trip (or null to unassign). */
  assignToTrip: (
    ids: { waypointIds?: string[]; routeIds?: string[]; shapeIds?: string[] },
    tripId: string | null,
  ) => void;

  /** Marks the id and clears it; returns true once when matched. */
  consumeLastCreated: (id: string) => boolean;
  /** Explicit setter for the long-press flow. */
  setLastCreated: (id: string | null) => void;

  clearAll: () => void;
}

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

const now = (): string => new Date().toISOString();

/**
 * v1 → v2 migration. Lifts the legacy single `photoUri` into the
 * new `photos[]` array, back-fills empty `tags` and missing `color`, and
 * normalizes route/shape rows with the new optional `tripId`/`tags` slots.
 * Idempotent: re-running on an already-v2 row is a no-op.
 */
const migrateV1toV2 = (persisted: unknown): unknown => {
  if (!persisted || typeof persisted !== "object") return persisted;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = persisted as any;
  const wps: unknown[] = Array.isArray(state.waypoints) ? state.waypoints : [];
  state.waypoints = wps.map((rawWp) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wp = rawWp as any;
    const photos: WaypointPhoto[] = Array.isArray(wp.photos) ? wp.photos : [];
    if (photos.length === 0 && typeof wp.photoUri === "string" && wp.photoUri.length > 0) {
      photos.push({
        id: newId(),
        uri: wp.photoUri,
        capturedAt: wp.createdAt ?? now(),
      });
    }
    return {
      ...wp,
      photos,
      tags: Array.isArray(wp.tags) ? wp.tags : [],
    };
  });
  if (!Array.isArray(state.trips)) state.trips = [];
  if (state.activeTripId === undefined) state.activeTripId = null;
  return state;
};

export const useFieldToolsStore = create<FieldToolsState>()(
  persist(
    (set, get) => ({
      waypoints: [],
      routes: [],
      shapes: [],
      measurements: [],
      trips: [],
      lastCreatedId: null,
      activeTripId: null,

      addWaypoint: (input) => {
        const wp: Waypoint = {
          id: input.id ?? newId(),
          createdAt: input.createdAt ?? now(),
          updatedAt: input.updatedAt ?? now(),
          kind: input.kind,
          name: input.name,
          notes: input.notes,
          lat: input.lat,
          lon: input.lon,
          color: input.color,
          photos: input.photos ?? [],
          tags: input.tags ?? [],
          tripId: input.tripId,
          accuracyAtCapture: input.accuracyAtCapture,
        };
        set({ waypoints: [wp, ...get().waypoints] });
        return wp;
      },
      updateWaypoint: (id, patch) =>
        set({
          waypoints: get().waypoints.map((w) =>
            w.id === id ? { ...w, ...patch, updatedAt: now() } : w,
          ),
        }),
      removeWaypoint: (id) => set({ waypoints: get().waypoints.filter((w) => w.id !== id) }),
      addWaypointPhoto: (waypointId, photo) => {
        const fullPhoto: WaypointPhoto = { ...photo, id: photo.id ?? newId() };
        set({
          waypoints: get().waypoints.map((w) =>
            w.id === waypointId ? { ...w, photos: [...w.photos, fullPhoto], updatedAt: now() } : w,
          ),
        });
      },
      removeWaypointPhoto: (waypointId, photoId) =>
        set({
          waypoints: get().waypoints.map((w) =>
            w.id === waypointId
              ? { ...w, photos: w.photos.filter((p) => p.id !== photoId), updatedAt: now() }
              : w,
          ),
        }),

      addRoute: (input) => {
        const route: CapturedRoute = {
          ...input,
          id: input.id ?? newId(),
        };
        set({ routes: [route, ...get().routes] });
        return route;
      },
      updateRoute: (id, patch) =>
        set({
          routes: get().routes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }),
      removeRoute: (id) => set({ routes: get().routes.filter((r) => r.id !== id) }),

      addShape: (input) => {
        const shape: DrawnShape = {
          ...input,
          id: input.id ?? newId(),
          createdAt: input.createdAt ?? now(),
        };
        set({ shapes: [shape, ...get().shapes] });
        return shape;
      },
      updateShape: (id, patch) =>
        set({
          shapes: get().shapes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        }),
      removeShape: (id) => set({ shapes: get().shapes.filter((s) => s.id !== id) }),

      addMeasurement: (input) => {
        const m: Measurement = {
          ...input,
          id: input.id ?? newId(),
          createdAt: input.createdAt ?? now(),
        };
        set({ measurements: [m, ...get().measurements] });
        return m;
      },
      removeMeasurement: (id) =>
        set({ measurements: get().measurements.filter((m) => m.id !== id) }),

      addTrip: (input) => {
        const trip: Trip = {
          id: input.id ?? newId(),
          createdAt: input.createdAt ?? now(),
          updatedAt: input.updatedAt ?? now(),
          name: input.name,
          color: input.color,
          icon: input.icon,
          notes: input.notes,
          archivedAt: input.archivedAt,
        };
        set({ trips: [trip, ...get().trips] });
        return trip;
      },
      updateTrip: (id, patch) =>
        set({
          trips: get().trips.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: now() } : t)),
        }),
      archiveTrip: (id) =>
        set({
          trips: get().trips.map((t) =>
            t.id === id ? { ...t, archivedAt: now(), updatedAt: now() } : t,
          ),
        }),
      removeTrip: (id) =>
        set({
          trips: get().trips.filter((t) => t.id !== id),
          // Detach assigned items so they don't dangle.
          waypoints: get().waypoints.map((w) =>
            w.tripId === id ? { ...w, tripId: undefined } : w,
          ),
          routes: get().routes.map((r) => (r.tripId === id ? { ...r, tripId: undefined } : r)),
          shapes: get().shapes.map((s) => (s.tripId === id ? { ...s, tripId: undefined } : s)),
        }),
      setActiveTrip: (id) => set({ activeTripId: id }),
      assignToTrip: ({ waypointIds, routeIds, shapeIds }, tripId) => {
        const wpSet = new Set(waypointIds ?? []);
        const rSet = new Set(routeIds ?? []);
        const shSet = new Set(shapeIds ?? []);
        set({
          waypoints: get().waypoints.map((w) =>
            wpSet.has(w.id) ? { ...w, tripId: tripId ?? undefined, updatedAt: now() } : w,
          ),
          routes: get().routes.map((r) =>
            rSet.has(r.id) ? { ...r, tripId: tripId ?? undefined } : r,
          ),
          shapes: get().shapes.map((s) =>
            shSet.has(s.id) ? { ...s, tripId: tripId ?? undefined } : s,
          ),
        });
      },

      consumeLastCreated: (id) => {
        if (get().lastCreatedId !== id) return false;
        set({ lastCreatedId: null });
        return true;
      },
      setLastCreated: (id) => set({ lastCreatedId: id }),

      clearAll: () =>
        set({
          waypoints: [],
          routes: [],
          shapes: [],
          measurements: [],
          trips: [],
          lastCreatedId: null,
          activeTripId: null,
        }),
    }),
    {
      name: "engage-mt:field-tools",
      // Routes through the platform-aware storage so the same
      // store state survives an iOS / Android app uninstall+reinstall via
      // the OS backup (Preferences plugin lives in the app container).
      // Web continues to use localStorage with no behavior change.
      storage: createJSONStorage(() => platformStorage()),
      version: 2,
      migrate: (persisted, fromVersion) => {
        if (fromVersion < 2) return migrateV1toV2(persisted) as FieldToolsState;
        return persisted as FieldToolsState;
      },
    },
  ),
);

/** Catalog of available waypoint kinds + display metadata. */
export const WAYPOINT_KIND_INFO: Record<
  WaypointKind,
  { label: string; icon: string; color: string }
> = {
  general: { label: "Waypoint", icon: "map-pin", color: "var(--fwp-blue)" },
  camp: { label: "Camp", icon: "tent", color: "var(--fwp-accent-explore)" },
  "kill-site": { label: "Kill site", icon: "target", color: "var(--fwp-danger)" },
  "trail-cam": { label: "Trail cam", icon: "camera", color: "var(--fwp-accent-hunt)" },
  blind: { label: "Blind / Stand", icon: "eye", color: "var(--fwp-accent-hunt)" },
  spring: { label: "Water source", icon: "droplet", color: "var(--fwp-accent-fish)" },
  "glassing-point": {
    label: "Glassing point",
    icon: "binoculars",
    color: "var(--fwp-accent-hunt)",
  },
  rub: { label: "Rub", icon: "trees", color: "var(--fwp-brown-raw)" },
  scrape: { label: "Scrape", icon: "shovel", color: "var(--fwp-brown-raw)" },
  scat: { label: "Scat", icon: "circle-dot", color: "var(--fwp-brown-raw)" },
  tracks: { label: "Tracks", icon: "footprints", color: "var(--fwp-brown-raw)" },
  hazard: { label: "Hazard", icon: "triangle-alert", color: "var(--fwp-danger)" },
  vehicle: { label: "Vehicle / Truck", icon: "truck", color: "var(--fwp-neutral-700)" },
  photo: { label: "Photo spot", icon: "camera", color: "var(--fwp-accent-explore)" },
  ridge: { label: "Ridge", icon: "mountain", color: "var(--fwp-brown-raw)" },
  saddle: { label: "Saddle", icon: "mountain-snow", color: "var(--fwp-brown-raw)" },
  water: { label: "Water", icon: "waves", color: "var(--fwp-accent-fish)" },
  feeding: { label: "Feeding sign", icon: "leaf", color: "var(--fwp-accent-hunt)" },
  bedding: { label: "Bedding", icon: "bed", color: "var(--fwp-accent-hunt)" },
};
