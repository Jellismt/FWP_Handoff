/**
 * @file cameraService.ts
 * @module engage-mt/services/mobile
 * @description Platform-adaptive photo capture for waypoint
 *              attachments. On Capacitor (iOS / Android) uses the
 *              native camera via `@capacitor/camera`; on web falls
 *              back to the existing `<input type="file" capture>` flow.
 *
 *              Returned shape is a data-URI string that the
 *              fieldToolsStore stores as `photoUri`. Native captures
 *              come back as `dataUrl` from the plugin so the storage
 *              format is identical web ↔ mobile.
 *
 *              Privacy: photos stay on-device. EXIF location is
 *              stripped client-side before any upload — the `stripExif`
 *              helper is exported for future TipMont / harvest-report
 *              upload paths. The capture function itself never sends
 *              anything anywhere.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createLogger } from "@/utils/logger";
import { isCapacitor } from "@/utils/capacitor";

const log = createLogger("camera");

/**
 * Open the camera (native) or file picker (web) and return a data URI.
 * Returns null when the user cancels or no source is available.
 */
export const capturePhoto = async (): Promise<string | null> => {
  if (isCapacitor()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // user picks: camera or gallery
        saveToGallery: false,
        // Long edge capped at the size the gallery shows; upright per EXIF.
        width: MAX_PHOTO_EDGE_PX,
        height: MAX_PHOTO_EDGE_PX,
        correctOrientation: true,
      });
      return photo.dataUrl ?? null;
    } catch (err) {
      log.warn("Capacitor camera capture failed; falling back to file picker", {
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through to file-picker fallback.
    }
  }
  return capturePhotoViaFilePicker();
};

/**
 * Hard upper bound on the file-picker promise. iOS Safari
 * sometimes never fires a focus + change event (PWA sandbox /
 * dismissed picker before mount), which would leave the outer
 * promise unresolved forever. After this many ms, we assume the user
 * walked away and resolve `null` so the UI can recover.
 */
const FILE_PICKER_TIMEOUT_MS = 60_000;

/**
 * Web fallback. Creates an off-DOM `<input type="file" accept="image/*"
 * capture="environment">` element, awaits the user's selection,
 * resolves with the data URI. Returns null on cancel or after a
 * 60-second hard timeout (see `FILE_PICKER_TIMEOUT_MS`).
 */
export const capturePhotoViaFilePicker = (): Promise<string | null> => {
  const pickerPromise = new Promise<string | null>((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    // `capture="environment"` hints to mobile browsers to default the
    // rear camera. Desktop browsers ignore the attribute + show the
    // standard file picker.
    input.capture = "environment";
    input.style.display = "none";
    let settled = false;
    const cleanup = (): void => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };
    input.addEventListener(
      "change",
      () => {
        if (settled) return;
        settled = true;
        const file = input.files?.[0];
        if (!file) {
          cleanup();
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          cleanup();
          resolve(typeof reader.result === "string" ? reader.result : null);
        };
        reader.onerror = () => {
          cleanup();
          resolve(null);
        };
        reader.readAsDataURL(file);
      },
      { once: true },
    );
    // Cancel detection: focus returns to the window without a file
    // selection. Fires after the file dialog closes.
    setTimeout(() => {
      window.addEventListener(
        "focus",
        () => {
          // Give the change event a tick to fire first; if it didn't,
          // user cancelled.
          setTimeout(() => {
            if (!settled) {
              settled = true;
              cleanup();
              resolve(null);
            }
          }, 300);
        },
        { once: true },
      );
    }, 100);
    document.body.appendChild(input);
    input.click();
  });

  // Race the picker promise against a hard upper bound so the UI
  // never hangs on a never-resolving cancel.
  const timeoutPromise = new Promise<string | null>((resolve) => {
    setTimeout(() => resolve(null), FILE_PICKER_TIMEOUT_MS);
  });
  return Promise.race([pickerPromise, timeoutPromise]);
};

/**
 * Strip EXIF location from a data-URI photo by round-tripping through a
 * canvas. Used by upload paths (TipMont) — not by the local waypoint
 * flow, which keeps EXIF for the user.
 *
 * Returns the original input unchanged if canvas decoding fails.
 */
/** Long edge of a stored photo. Larger captures are scaled down before saving. */
export const MAX_PHOTO_EDGE_PX = 2048;

/**
 * Redraws a photo onto a canvas so the stored file carries no EXIF (which can
 * include the GPS position and device identity) and is no larger than
 * `maxEdge` on its long side.
 */
export const downscaleDataUrl = async (
  dataUrl: string,
  maxEdge = MAX_PHOTO_EDGE_PX,
): Promise<string> => {
  if (typeof document === "undefined") return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

/** EXIF stripping is the same redraw; kept under the name callers use. */
export const stripExif = (dataUrl: string): Promise<string> => downscaleDataUrl(dataUrl);
