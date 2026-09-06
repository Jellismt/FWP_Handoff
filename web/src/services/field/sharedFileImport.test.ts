/**
 * @file sharedFileImport.test.ts
 * @module engage-mt/services/field
 * @description Unit tests for — reading a GPX/KML file the OS handed the
 *              app. Mocks @capacitor/filesystem + the GPX/KML parsers +
 *              pendingImportStore at the seam to verify: no-op on web, extension-
 *              and content-sniffed GPX-vs-KML routing, basename derivation from
 *              the URI, staging the parsed result, and — critically — that a read
 *              failure resolves `false` rather than throwing (a bad open must
 *              never crash the app).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GpxImportResult } from "@/services/field/gpxImport";

const h = vi.hoisted(() => ({
  isCapacitor: vi.fn(() => true),
  readFile: vi.fn<(opts: { path: string; encoding?: string }) => Promise<{ data: string }>>(),
  parseGpx: vi.fn(),
  parseKml: vi.fn(),
  setResult: vi.fn(),
}));

const EMPTY_RESULT: GpxImportResult = { waypoints: [], routes: [], warnings: [] };

vi.mock("@/utils/capacitor", () => ({ isCapacitor: h.isCapacitor }));
vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { readFile: h.readFile },
}));
vi.mock("@/services/field/gpxImport", () => ({ parseGpx: h.parseGpx }));
vi.mock("@/services/field/kmlImport", () => ({ parseKml: h.parseKml }));
vi.mock("@/store/field/pendingImportStore", () => ({
  usePendingImportStore: { getState: () => ({ setResult: h.setResult }) },
}));

import { stageSharedFileImport } from "./sharedFileImport";

beforeEach(() => {
  vi.clearAllMocks();
  h.isCapacitor.mockReturnValue(true);
  h.parseGpx.mockReturnValue({ ...EMPTY_RESULT, warnings: ["gpx"] });
  h.parseKml.mockReturnValue({ ...EMPTY_RESULT, warnings: ["kml"] });
  h.readFile.mockResolvedValue({ data: "<gpx></gpx>" });
});

describe("stageSharedFileImport — platform guard", () => {
  it("is a no-op returning false on web (never reads the file)", async () => {
    h.isCapacitor.mockReturnValue(false);
    await expect(stageSharedFileImport("file:///tmp/pin.gpx")).resolves.toBe(false);
    expect(h.readFile).not.toHaveBeenCalled();
    expect(h.setResult).not.toHaveBeenCalled();
  });
});

describe("stageSharedFileImport — format sniffing", () => {
  it("parses a .gpx URI with the GPX parser and stages the result", async () => {
    h.readFile.mockResolvedValue({ data: "<gpx>...</gpx>" });
    const ok = await stageSharedFileImport("file:///var/mobile/tmp/trip.gpx");
    expect(ok).toBe(true);
    expect(h.parseGpx).toHaveBeenCalledWith("<gpx>...</gpx>");
    expect(h.parseKml).not.toHaveBeenCalled();
    expect(h.setResult).toHaveBeenCalledWith(
      expect.objectContaining({ warnings: ["gpx"] }),
      "trip.gpx",
    );
  });

  it("parses a .kml URI with the KML parser", async () => {
    h.readFile.mockResolvedValue({ data: "<kml>...</kml>" });
    const ok = await stageSharedFileImport("content://downloads/document/waypoints.kml");
    expect(ok).toBe(true);
    expect(h.parseKml).toHaveBeenCalledWith("<kml>...</kml>");
    expect(h.parseGpx).not.toHaveBeenCalled();
  });

  it("falls back to a <kml content-probe when the extension is ambiguous", async () => {
    // No .gpx / .kml in the name; the content opens with a <kml> tag.
    h.readFile.mockResolvedValue({ data: '<?xml version="1.0"?><kml xmlns="...">' });
    const ok = await stageSharedFileImport("content://provider/document/12345");
    expect(ok).toBe(true);
    expect(h.parseKml).toHaveBeenCalledTimes(1);
    expect(h.parseGpx).not.toHaveBeenCalled();
  });

  it("defaults to GPX for an ambiguous name whose content is not KML", async () => {
    h.readFile.mockResolvedValue({ data: '<?xml version="1.0"?><gpx>...' });
    const ok = await stageSharedFileImport("content://provider/document/98765");
    expect(ok).toBe(true);
    expect(h.parseGpx).toHaveBeenCalledTimes(1);
    expect(h.parseKml).not.toHaveBeenCalled();
  });
});

describe("stageSharedFileImport — basename derivation", () => {
  it("URL-decodes the filename and strips query/hash for the source label", async () => {
    await stageSharedFileImport("file:///tmp/My%20Pin.gpx?x=1#frag");
    expect(h.setResult).toHaveBeenCalledWith(expect.anything(), "My Pin.gpx");
  });

  it("falls back to a friendly label when the URI has no filename segment", async () => {
    await stageSharedFileImport("content://");
    expect(h.setResult).toHaveBeenCalledWith(expect.anything(), "shared file");
  });
});

describe("stageSharedFileImport — resilience", () => {
  it("resolves false (never throws) when the filesystem read fails", async () => {
    h.readFile.mockRejectedValue(new Error("permission denied"));
    await expect(stageSharedFileImport("file:///tmp/nope.gpx")).resolves.toBe(false);
    expect(h.setResult).not.toHaveBeenCalled();
  });

  it("resolves false when the parser throws on malformed content", async () => {
    h.parseGpx.mockImplementation(() => {
      throw new Error("malformed XML");
    });
    await expect(stageSharedFileImport("file:///tmp/bad.gpx")).resolves.toBe(false);
    expect(h.setResult).not.toHaveBeenCalled();
  });

  it("rejects an oversize file with a warning WITHOUT parsing it (DoS guard)", async () => {
    // 16 MB + 1 char — one past MAX_IMPORT_CHARS.
    h.readFile.mockResolvedValue({ data: "x".repeat(16 * 1024 * 1024 + 1) });
    const ok = await stageSharedFileImport("file:///tmp/huge.gpx");
    expect(ok).toBe(true);
    expect(h.parseGpx).not.toHaveBeenCalled();
    expect(h.parseKml).not.toHaveBeenCalled();
    expect(h.setResult).toHaveBeenCalledWith(
      expect.objectContaining({
        waypoints: [],
        routes: [],
        warnings: [expect.stringContaining("too large")],
      }),
      "huge.gpx",
    );
  });
});
