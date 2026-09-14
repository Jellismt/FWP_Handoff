/**
 * @file sharedFileImport.ts
 * @module engage-mt/services/field
 * @description Read a GPX/KML file that the OS handed the app (a
 *              `file://` / `content://` URI from the share sheet or Files app),
 *              parse it, and stage it for the import preview. This is the native
 *              half of "open a pin another app exported" — the file-association handler
 *              routes here via `appLifecycle.onSharedFile`.
 *
 * Reads through @capacitor/filesystem behind the guard
 *              (dynamic import; no-op on web). Format is sniffed from the URI
 *              extension, falling back to a `<kml` content probe. On any error
 *              it resolves quietly (returns false) — a failed open should never
 *              crash the app.
 *
 *              Privacy: the file is read on-device and parsed in-browser; no
 *              upload. Per docs/rules/privacy.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-14
 * @version 1.1.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createLogger } from "@/utils/logger";
import { isCapacitor } from "@/utils/capacitor";
import { parseGpx } from "@/services/field/gpxImport";
import { parseKml } from "@/services/field/kmlImport";
import { usePendingImportStore } from "@/store/field/pendingImportStore";

const log = createLogger("shared-file-import");

/**
 * Upper bound on a shared GPX/KML file we'll parse. A real-world track — even a
 * dense multi-day GPS log — is well under a megabyte; 16 MB is a generous
 * ceiling that still stops a hostile or corrupt multi-hundred-MB file from
 * exhausting the WebView when handed to DOMParser. Checked BEFORE parse. The
 * link-share path has its own tighter bound (MAX_LINK_BYTES in pinShareCodec).
 */
const MAX_IMPORT_CHARS = 16 * 1024 * 1024;

interface FilesystemReadResult {
  data: string;
}
interface FilesystemPlugin {
  readFile: (opts: { path: string; encoding?: string }) => Promise<FilesystemReadResult>;
}

const basename = (uri: string): string => {
  try {
    const clean = uri.split(/[?#]/)[0];
    return decodeURIComponent(clean.split("/").pop() || "shared file");
  } catch {
    return "shared file";
  }
};

/** Parse GPX vs KML from a filename hint + content sniff. */
const parseSharedText = (uri: string, text: string): ReturnType<typeof parseGpx> => {
  const lower = uri.toLowerCase();
  if (lower.includes(".kml") || (!lower.includes(".gpx") && /<kml[\s>]/i.test(text))) {
    return parseKml(text);
  }
  return parseGpx(text);
};

/**
 * Read + parse a shared GPX/KML file and stage it in the pending-import store.
 * Returns true when something was staged. No-op (false) on web.
 */
export const stageSharedFileImport = async (uri: string): Promise<boolean> => {
  if (!isCapacitor()) return false;
  try {
    // Literal import — @capacitor/filesystem is a web dep, so Vite bundles it into
    // a lazy chunk that resolves natively. A @vite-ignore'd variable import leaves
    // an unresolvable bare specifier → shared GPX/KML "open in Engage MT" silently
    // fails. Fetched only inside this isCapacitor() guard → no web load.
    const { Filesystem } = (await import("@capacitor/filesystem")) as unknown as {
      Filesystem: FilesystemPlugin;
    };
    // UTF-8 text read. content:// / file:// full URIs are read directly.
    const { data } = await Filesystem.readFile({ path: uri, encoding: "utf8" });
    // Size-gate BEFORE handing the string to DOMParser — reject an oversize /
    // hostile file with a friendly preview warning instead of parsing it.
    if (data.length > MAX_IMPORT_CHARS) {
      log.warn("Shared file exceeds import size limit", { chars: data.length });
      usePendingImportStore.getState().setResult(
        {
          waypoints: [],
          routes: [],
          warnings: [
            "This file is too large to import (limit 16 MB). Try exporting a smaller area.",
          ],
        },
        basename(uri),
      );
      return true;
    }
    const result = parseSharedText(uri, data);
    usePendingImportStore.getState().setResult(result, basename(uri));
    return true;
  } catch (err) {
    log.warn("Failed to read shared file", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
};
