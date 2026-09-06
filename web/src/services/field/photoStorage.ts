/**
 * @file photoStorage.ts
 * @module engage-mt/services/field
 * @description Storage abstraction for waypoint photos.
 *              On the web, photos stay inline as data-URIs in the Zustand
 *              store (today's behavior). On Capacitor, the abstraction
 *              writes the captured bytes to `@capacitor/filesystem` under
 *              `Data/field/photos/<photoId>.jpg` and returns the
 *              persistent `file://` URI so the store JSON stays small +
 *              the photo survives app updates.
 *
 * Layers thumbnail generation on top of this
 *              boundary; that pass will add a sibling `<photoId>.thumb.jpg`
 *              + extend the public type with `thumbUri`.
 *
 *              Per [docs/rules/mobile.md § Platform guards]
 *              (../../../docs/rules/mobile.md) every Capacitor path is
 *              behind `isCapacitor()`; the filesystem plugin is dynamic-
 *              imported so the web bundle doesn't ship it.
 *
 *              Per [docs/rules/privacy.md](../../../docs/rules/privacy.md):
 *              photos NEVER leave the device unless the user explicitly
 *              initiates a share. EXIF stripping is reserved for the
 *              *upload* boundary (TipMont); locally the user owns their
 *              EXIF.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-06-17
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { isCapacitor } from "@/utils/capacitor";
import { createLogger } from "@/utils/logger";

const log = createLogger("photo-storage");

const PHOTO_DIR = "field/photos";

const dataUriToBase64 = (dataUri: string): { base64: string; mime: string } | null => {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUri);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
};

const extForMime = (mime: string): string => {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/heic":
    case "image/heif":
      return "heic";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    case "image/jpg":
    default:
      return "jpg";
  }
};

/**
 * Persist a captured photo to durable storage and return the URI to store
 * on the Waypoint. On web returns the input data-URI verbatim; on Capacitor
 * writes the bytes to Filesystem under a per-id path and returns the
 * `file://` URI.
 *
 * Failures fall back to returning the original URI — the user never loses
 * the photo, even if the filesystem write fails for quota / permission /
 * disk-full reasons.
 */
export const persistPhoto = async (photoId: string, dataUri: string): Promise<string> => {
  if (!isCapacitor()) return dataUri;

  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const parsed = dataUriToBase64(dataUri);
    if (!parsed) return dataUri;
    const ext = extForMime(parsed.mime);
    const path = `${PHOTO_DIR}/${photoId}.${ext}`;

    // Ensure the directory exists. Plugin idempotently no-ops when present.
    try {
      await Filesystem.mkdir({
        path: PHOTO_DIR,
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      /* directory already exists — ignore */
    }

    await Filesystem.writeFile({
      path,
      directory: Directory.Data,
      data: parsed.base64,
    });

    const result = await Filesystem.getUri({ path, directory: Directory.Data });
    return result.uri;
  } catch (err) {
    log.warn("persistPhoto failed", { error: err instanceof Error ? err.message : err });
    return dataUri;
  }
};

/**
 * Best-effort delete of a photo file. Idempotent — already-missing files
 * resolve successfully so the caller doesn't need to handle ENOENT.
 */
export const deletePhotoFile = async (photoId: string): Promise<void> => {
  if (!isCapacitor()) return;
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    for (const ext of ["jpg", "png", "heic", "webp"]) {
      const path = `${PHOTO_DIR}/${photoId}.${ext}`;
      try {
        await Filesystem.deleteFile({ path, directory: Directory.Data });
      } catch {
        /* missing file — ignore */
      }
    }
  } catch (err) {
    log.debug("deletePhotoFile noop", { error: err instanceof Error ? err.message : err });
  }
};
