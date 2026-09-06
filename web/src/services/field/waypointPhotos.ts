/**
 * @file waypointPhotos.ts
 * @module engage-mt/services/field
 * @description The one seam that attaches / detaches a photo to a waypoint. It
 *              pre-generates the photo id, persists the captured bytes to durable
 *              storage via `persistPhoto` (filesystem `file://` on Capacitor,
 *              data-URI passthrough on web), and only THEN records the resulting
 *              URI on the waypoint. Without this seam the raw full-resolution
 *              data-URI was written straight into `@capacitor/preferences`, which
 *              bloats the persisted store and risks the OS quota on a device with
 *              many photos (the persist boundary existed but was never called).
 *
 *              Removal mirrors it: drop the store entry AND best-effort delete the
 *              on-disk file so orphaned photo bytes don't accumulate.
 *
 *              Per [docs/rules/privacy.md](../../../docs/rules/privacy.md)
 *              photos never leave the device unless the user explicitly shares.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useFieldToolsStore } from "@/store/field/fieldToolsStore";
import { isCapacitor } from "@/utils/capacitor";
import { persistPhoto, deletePhotoFile } from "./photoStorage";

/**
 * On the web, photos live inside the browser's localStorage as data URLs, so
 * the library keeps a small budget rather than silently losing everything at
 * the storage quota.
 */
export const WEB_PHOTO_BUDGET_BYTES = 3_000_000;

export class PhotoQuotaError extends Error {
  constructor(
    public readonly usedBytes: number,
    public readonly budgetBytes: number,
  ) {
    super("The photo library is full on this browser. Remove a photo or use the mobile app.");
    this.name = "PhotoQuotaError";
  }
}

/** Approximate stored size of a data URL. */
export const dataUrlBytes = (dataUrl: string): number => {
  const comma = dataUrl.indexOf(",");
  const payload = comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
  return Math.round((payload.length * 3) / 4);
};

export const webPhotoBytesInUse = (): number =>
  useFieldToolsStore
    .getState()
    .waypoints.flatMap((w) => w.photos ?? [])
    .reduce((sum, p) => sum + (p.uri.startsWith("data:") ? dataUrlBytes(p.uri) : 0), 0);

/** Stable, collision-resistant photo id; also names the on-disk file. */
const makePhotoId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `photo_${crypto.randomUUID()}`
    : `photo_${Date.now()}_${Math.round(Math.random() * 1e6)}`;

/**
 * Attach a freshly-captured photo (a data-URI from the camera / picker) to a
 * waypoint: persist the bytes first, then store the durable URI. Resolves when
 * the store has been updated. Never throws — `persistPhoto` falls back to the
 * data-URI if the filesystem write fails, so the user never loses the photo.
 */
export const attachWaypointPhoto = async (
  waypointId: string,
  dataUri: string,
  accuracyM?: number,
): Promise<void> => {
  if (!isCapacitor()) {
    const used = webPhotoBytesInUse();
    if (used + dataUrlBytes(dataUri) > WEB_PHOTO_BUDGET_BYTES) {
      throw new PhotoQuotaError(used, WEB_PHOTO_BUDGET_BYTES);
    }
  }
  const id = makePhotoId();
  const uri = await persistPhoto(id, dataUri);
  useFieldToolsStore.getState().addWaypointPhoto(waypointId, {
    id,
    uri,
    capturedAt: new Date().toISOString(),
    ...(accuracyM != null ? { accuracyM } : {}),
  });
};

/** Remove a photo from a waypoint and best-effort delete its on-disk file. */
export const detachWaypointPhoto = (waypointId: string, photoId: string): void => {
  useFieldToolsStore.getState().removeWaypointPhoto(waypointId, photoId);
  void deletePhotoFile(photoId);
};
