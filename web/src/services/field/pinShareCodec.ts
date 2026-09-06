/**
 * @file pinShareCodec.ts
 * @module engage-mt/services/field
 * @description High-fidelity peer-to-peer pin-share codec. Encodes a
 *              selection of field-tools items (waypoints / routes / shapes and
 *              an optional parent trip) into a compact, URL-safe string that
 *              round-trips EVERY Engage MT field (kind, color, notes, tags) —
 *              the half commercial apps keep proprietary. The companion
 *              `shareLink.ts` wraps the string in a deep / universal link; the
 *              recipient decodes it back into the exact same items.
 *
 *              Photo BYTES are never encoded (they are local-only per
 *              docs/rules/privacy.md and would balloon the link). The bundle
 *              records how many photos were omitted so the receive preview can
 *              say "N photos not included" without carrying the pixels.
 *
 *              Privacy: pure client-side encode/decode. The payload only ever
 *              travels inside the link/file the user explicitly hands to someone
 *              via the native share sheet — no network surface.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-14
 * @version 1.1.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type {
  CapturedRoute,
  DrawnShape,
  Trip,
  Waypoint,
  WaypointColorName,
  WaypointKind,
} from "@/store/field/fieldToolsStore";

/** Current share-bundle schema version. Bump when the shape changes. */
export const SHARE_BUNDLE_VERSION = 2 as const;

/**
 * Maximum length (in characters) of the encoded `?d=` payload that is still
 * safe to carry in a deep / universal link. iOS and Android both reliably
 * handle well over this; we stay conservative so a link survives being pasted
 * into iMessage / SMS, which can truncate very long URLs. Larger selections
 * (a whole trip) fall back to a file-only share — see `isLinkSafe`.
 */
const MAX_LINK_BYTES = 1800;

/**
 * Hard ceiling on an *incoming* `?d=` payload we're willing to decode. Our own
 * encoder never exceeds MAX_LINK_BYTES (1800), but `/field/receive?d=…` is an
 * untrusted entry point — a hostile link could carry a multi-megabyte `d` param
 * aimed at exhausting atob/TextDecoder/JSON.parse. This bound is ~50× our own
 * max (comfortable for any legitimate link) while refusing an abusive one.
 */
export const MAX_DECODE_CHARS = 100_000;

/**
 * A versioned, shareable subset of the field-tools store. Mirrors
 * `FieldBackupBundle` but trimmed to the items the user chose to share and
 * tagged `kind: "share"` so a decode can reject a full backup pasted by
 * mistake.
 */
export interface EngageMtShareBundle {
  version: typeof SHARE_BUNDLE_VERSION;
  kind: "share";
  /** ISO timestamp the bundle was created (for "shared on" context). */
  createdAt: string;
  /** Source app + build, for diagnostics + forward-compat decisions. */
  app: { name: "engage-mt"; build: string };
  waypoints?: Waypoint[];
  routes?: CapturedRoute[];
  shapes?: DrawnShape[];
  /** Parent trip, when the user shared a whole trip. */
  trip?: Trip;
  /** Count of photos stripped from the payload (bytes stay on the device). */
  photosOmitted: number;
}

/** The raw items a caller wants to share. */
export interface ShareSelection {
  waypoints?: readonly Waypoint[];
  routes?: readonly CapturedRoute[];
  shapes?: readonly DrawnShape[];
  trip?: Trip;
}

/** Thrown when a `?d=` payload can't be decoded into a valid share bundle. */
export class ShareDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareDecodeError";
  }
}

const APP_BUILD =
  (typeof window !== "undefined" &&
    (window as unknown as { __ENGAGE_MT_BUILD__?: string }).__ENGAGE_MT_BUILD__) ||
  "dev";

/** Strip photo bytes from a waypoint; the recipient can't resolve local URIs. */
const stripPhotos = (w: Waypoint): Waypoint => ({ ...w, photos: [], photoUri: undefined });

/**
 * Build a share bundle from a selection of items. Photos are removed (their
 * bytes are local-only) and counted so the preview can disclose the omission.
 */
export const buildShareBundle = (selection: ShareSelection): EngageMtShareBundle => {
  const waypoints = selection.waypoints ?? [];
  const photosOmitted = waypoints.reduce((sum, w) => sum + (w.photos?.length ?? 0), 0);
  const bundle: EngageMtShareBundle = {
    version: SHARE_BUNDLE_VERSION,
    kind: "share",
    createdAt: new Date().toISOString(),
    app: { name: "engage-mt", build: APP_BUILD },
    photosOmitted,
  };
  if (waypoints.length) bundle.waypoints = waypoints.map(stripPhotos);
  if (selection.routes?.length) bundle.routes = [...selection.routes];
  if (selection.shapes?.length) bundle.shapes = [...selection.shapes];
  if (selection.trip) bundle.trip = selection.trip;
  return bundle;
};

// --- base64url (UTF-8 safe) -------------------------------------------------
// btoa/atob handle binary strings only; encode through TextEncoder/Decoder so
// non-ASCII names (accents, emoji in notes) survive the round-trip. Both
// globals exist in the browser and in the jsdom/node test environments.

const toBase64Url = (json: string): string => {
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (encoded: string): string => {
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

/** Encode a share bundle to a URL-safe `?d=` payload string. */
export const encodeShareBundle = (bundle: EngageMtShareBundle): string =>
  toBase64Url(JSON.stringify(bundle));

/* ── CO-4: sanitize untrusted decoded items ──────────────────────────────
 * `?d=` is an untrusted entry point. Before this, decode copied `waypoints` /
 * `routes` / `shapes` VERBATIM into a persisted store — so a hostile or
 * malformed item (unknown `kind`, string `lat`, missing `path`) crashed
 * WaypointCard on render AND survived restarts. These coerce/drop every field
 * to its declared type at the decode chokepoint, so every downstream consumer
 * (receive preview + commit) is handed valid data. Dropping an item (return
 * null) is correct for the un-coercible cases (a pin with no real coordinates
 * isn't a pin). */
const WAYPOINT_KINDS = new Set<WaypointKind>([
  "general",
  "camp",
  "kill-site",
  "trail-cam",
  "blind",
  "spring",
  "glassing-point",
  "rub",
  "scrape",
  "scat",
  "tracks",
  "hazard",
  "vehicle",
  "photo",
  "ridge",
  "saddle",
  "water",
  "feeding",
  "bedding",
]);
const WAYPOINT_COLORS = new Set<WaypointColorName>([
  "blue",
  "green",
  "orange",
  "yellow",
  "red",
  "brown",
  "flow",
  "temp",
  "fire",
  "fish",
  "park",
  "snow",
  "wind",
  "elev",
  "drought",
  "mercury",
  "wildlife",
]);
const SHAPE_KINDS = new Set<DrawnShape["shape"]>(["polygon", "polyline", "rectangle", "circle"]);
const SHAPE_COLORS = new Set<DrawnShape["color"]>([
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
]);

const NAME_MAX = 120;
const NOTES_MAX = 1000;
const TAG_MAX = 40;
const ID_MAX = 100;

let sanitizeCounter = 0;
const fallbackId = (prefix: string): string => `share-${prefix}-${(sanitizeCounter += 1)}`;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
const finiteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const validLat = (v: unknown): v is number => finiteNum(v) && Math.abs(v) <= 90;
const validLon = (v: unknown): v is number => finiteNum(v) && Math.abs(v) <= 180;
const clampStr = (v: unknown, max: number, fallback = ""): string =>
  typeof v === "string" ? v.slice(0, max) : fallback;
const optStr = (v: unknown, max: number): string | undefined =>
  typeof v === "string" ? v.slice(0, max) : undefined;
const optId = (v: unknown): string | undefined =>
  typeof v === "string" && v ? v.slice(0, ID_MAX) : undefined;
const cleanTags = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.slice(0, TAG_MAX))
        .slice(0, 50)
    : [];
/** Keep only well-formed [lon, lat] pairs. */
const cleanPath = (v: unknown): Array<[number, number]> =>
  Array.isArray(v)
    ? v
        .filter(
          (p): p is [number, number] =>
            Array.isArray(p) && p.length >= 2 && validLon(p[0]) && validLat(p[1]),
        )
        .map((p) => [p[0], p[1]] as [number, number])
    : [];

const sanitizeWaypoint = (raw: unknown): Waypoint | null => {
  if (!isObj(raw) || !validLat(raw.lat) || !validLon(raw.lon)) return null;
  const now = clampStr(raw.createdAt, 40) || new Date().toISOString();
  return {
    id: optId(raw.id) ?? fallbackId("wp"),
    kind: WAYPOINT_KINDS.has(raw.kind as WaypointKind) ? (raw.kind as WaypointKind) : "general",
    name: clampStr(raw.name, NAME_MAX, "Shared pin"),
    notes: optStr(raw.notes, NOTES_MAX),
    lat: raw.lat,
    lon: raw.lon,
    createdAt: now,
    updatedAt: clampStr(raw.updatedAt, 40) || now,
    color: WAYPOINT_COLORS.has(raw.color as WaypointColorName)
      ? (raw.color as WaypointColorName)
      : undefined,
    photos: [], // photo bytes are never shared (privacy rule) — always empty
    tags: cleanTags(raw.tags),
    ...(optId(raw.tripId) ? { tripId: optId(raw.tripId) } : {}),
    ...(finiteNum(raw.accuracyAtCapture) ? { accuracyAtCapture: raw.accuracyAtCapture } : {}),
  };
};

const sanitizeRoute = (raw: unknown): CapturedRoute | null => {
  if (!isObj(raw)) return null;
  const path = cleanPath(raw.path);
  if (path.length === 0) return null; // a route with no valid points isn't one
  const startedAt = clampStr(raw.startedAt, 40) || new Date().toISOString();
  return {
    id: optId(raw.id) ?? fallbackId("rt"),
    name: clampStr(raw.name, NAME_MAX, "Shared route"),
    notes: optStr(raw.notes, NOTES_MAX),
    path,
    ...(Array.isArray(raw.elevationFt) ? { elevationFt: raw.elevationFt.filter(finiteNum) } : {}),
    distanceMi: finiteNum(raw.distanceMi) ? raw.distanceMi : 0,
    gainFt: finiteNum(raw.gainFt) ? raw.gainFt : 0,
    startedAt,
    endedAt: clampStr(raw.endedAt, 40) || startedAt,
    ...(optId(raw.tripId) ? { tripId: optId(raw.tripId) } : {}),
    tags: cleanTags(raw.tags),
  };
};

const sanitizeShape = (raw: unknown): DrawnShape | null => {
  if (!isObj(raw)) return null;
  const vertices = cleanPath(raw.vertices);
  if (vertices.length === 0) return null;
  return {
    id: optId(raw.id) ?? fallbackId("sh"),
    name: clampStr(raw.name, NAME_MAX, "Shared shape"),
    shape: SHAPE_KINDS.has(raw.shape as DrawnShape["shape"])
      ? (raw.shape as DrawnShape["shape"])
      : "polyline",
    vertices,
    color: SHAPE_COLORS.has(raw.color as DrawnShape["color"])
      ? (raw.color as DrawnShape["color"])
      : "blue",
    notes: optStr(raw.notes, NOTES_MAX),
    createdAt: clampStr(raw.createdAt, 40) || new Date().toISOString(),
    ...(optId(raw.tripId) ? { tripId: optId(raw.tripId) } : {}),
    tags: cleanTags(raw.tags),
  };
};

const sanitizeTrip = (raw: unknown): Trip | undefined => {
  if (!isObj(raw)) return undefined;
  const now = clampStr(raw.createdAt, 40) || new Date().toISOString();
  return {
    id: optId(raw.id) ?? fallbackId("trip"),
    name: clampStr(raw.name, NAME_MAX, "Shared trip"),
    color: WAYPOINT_COLORS.has(raw.color as WaypointColorName)
      ? (raw.color as WaypointColorName)
      : "blue",
    ...(optStr(raw.icon, 40) ? { icon: optStr(raw.icon, 40) } : {}),
    notes: optStr(raw.notes, NOTES_MAX),
    createdAt: now,
    updatedAt: clampStr(raw.updatedAt, 40) || now,
    ...(optStr(raw.archivedAt, 40) ? { archivedAt: optStr(raw.archivedAt, 40) } : {}),
  };
};

/** Sanitize an untrusted array, dropping nulls; returns undefined when empty. */
const sanitizeList = <T>(v: unknown, fn: (raw: unknown) => T | null): T[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out = v.map(fn).filter((x): x is T => x !== null);
  return out.length ? out : undefined;
};

/**
 * Decode a `?d=` payload back into a share bundle. Throws `ShareDecodeError`
 * on malformed input, a wrong `kind`, or an unsupported `version` so callers
 * can show a graceful error sheet rather than crash.
 */
export const decodeShareBundle = (encoded: string): EngageMtShareBundle => {
  if (!encoded || typeof encoded !== "string") {
    throw new ShareDecodeError("Empty share payload.");
  }
  if (encoded.length > MAX_DECODE_CHARS) {
    throw new ShareDecodeError("Share payload is too large.");
  }
  let json: string;
  try {
    json = fromBase64Url(encoded);
  } catch {
    throw new ShareDecodeError("Share payload isn't valid base64.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ShareDecodeError("Share payload isn't valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new ShareDecodeError("Share payload isn't an object.");
  }
  const bundle = parsed as Partial<EngageMtShareBundle>;
  if (bundle.kind !== "share") {
    throw new ShareDecodeError("Not an Engage MT share link.");
  }
  if (bundle.version !== SHARE_BUNDLE_VERSION) {
    throw new ShareDecodeError(`Unsupported share version: ${String(bundle.version)}`);
  }
  // Prototype-pollution safe by construction: we build a FRESH object literal
  // and copy only the known fields off `bundle`. A hostile `__proto__` /
  // `constructor` key in the JSON lands as an own (ignored) property on `parsed`
  // — JSON.parse never walks it onto Object.prototype, and we never spread or
  // deep-merge `bundle` into anything. Frozen so no downstream code mutates a
  // decoded-from-untrusted-input bundle in place.
  return Object.freeze({
    version: SHARE_BUNDLE_VERSION,
    kind: "share",
    createdAt: typeof bundle.createdAt === "string" ? bundle.createdAt : new Date().toISOString(),
    app: bundle.app ?? { name: "engage-mt" as const, build: "unknown" },
    // CO-4: every item is coerced/dropped to its declared type — never trusted.
    waypoints: sanitizeList(bundle.waypoints, sanitizeWaypoint),
    routes: sanitizeList(bundle.routes, sanitizeRoute),
    shapes: sanitizeList(bundle.shapes, sanitizeShape),
    trip: sanitizeTrip(bundle.trip),
    photosOmitted:
      typeof bundle.photosOmitted === "number" && Number.isFinite(bundle.photosOmitted)
        ? bundle.photosOmitted
        : 0,
  });
};

/** Total shareable items in a bundle (excludes the parent trip wrapper). */
export const countBundleItems = (bundle: EngageMtShareBundle): number =>
  (bundle.waypoints?.length ?? 0) + (bundle.routes?.length ?? 0) + (bundle.shapes?.length ?? 0);

/**
 * Whether a bundle is small enough to carry in a link. When `false`, the
 * caller should fall back to a file-only share (GPX/KML) so an oversize trip
 * still goes through.
 */
export const isLinkSafe = (bundle: EngageMtShareBundle): boolean =>
  encodeShareBundle(bundle).length <= MAX_LINK_BYTES;
