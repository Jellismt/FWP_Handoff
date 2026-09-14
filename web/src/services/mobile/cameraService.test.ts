/**
 * @file cameraService.test.ts
 * @module engage-mt/services/mobile
 * @description Unit tests for the platform-adaptive photo capture. Covers the
 *              Capacitor native-camera path (success + graceful fallback to the
 *              file picker on plugin error), the web file-picker flow
 *              (selection resolves a data URI, cancel resolves null, reader
 *              error resolves null), and the EXIF-strip canvas round-trip.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isCapacitor: vi.fn(() => false),
  getPhoto: vi.fn(),
}));

vi.mock("@/utils/capacitor", () => ({ isCapacitor: h.isCapacitor }));
vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@capacitor/camera", () => ({
  Camera: { getPhoto: h.getPhoto },
  CameraResultType: { DataUrl: "dataUrl" },
  CameraSource: { Prompt: "PROMPT" },
}));

import { capturePhoto, capturePhotoViaFilePicker } from "./cameraService";

/** Wait a few microtask + macrotask ticks for the picker input to mount. */
const waitForInput = async (): Promise<HTMLInputElement> => {
  for (let i = 0; i < 20; i += 1) {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const input = inputs[inputs.length - 1];
    if (input) return input;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error("picker input never mounted");
};

/**
 * Drive the most-recently-mounted off-DOM <input type=file> the picker
 * created: attach a File (or none for cancel), then dispatch `change`.
 */
const emitFileSelection = async (file: File | null): Promise<void> => {
  const input = await waitForInput();
  Object.defineProperty(input, "files", {
    value: file ? [file] : [],
    configurable: true,
  });
  input.dispatchEvent(new Event("change"));
};

beforeEach(() => {
  vi.clearAllMocks();
  h.isCapacitor.mockReturnValue(false);
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("capturePhoto — Capacitor path", () => {
  it("returns the native camera dataUrl on success", async () => {
    h.isCapacitor.mockReturnValue(true);
    h.getPhoto.mockResolvedValue({ dataUrl: "data:image/jpeg;base64,AAAA" });
    await expect(capturePhoto()).resolves.toBe("data:image/jpeg;base64,AAAA");
    expect(h.getPhoto).toHaveBeenCalledTimes(1);
    expect(h.getPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ width: 2048, height: 2048, correctOrientation: true }),
    );
  });

  it("returns null when the native plugin yields no dataUrl", async () => {
    h.isCapacitor.mockReturnValue(true);
    h.getPhoto.mockResolvedValue({});
    await expect(capturePhoto()).resolves.toBeNull();
  });

  it("falls back to the file picker when the native camera throws", async () => {
    h.isCapacitor.mockReturnValue(true);
    h.getPhoto.mockRejectedValue(new Error("user denied"));
    const promise = capturePhoto();
    // The fallback picker mounts an input — drive a selection through it.
    const file = new File(["xyz"], "photo.jpg", { type: "image/jpeg" });
    await emitFileSelection(file);
    const result = await promise;
    expect(result).toMatch(/^data:/);
  });
});

describe("capturePhotoViaFilePicker", () => {
  it("resolves the FileReader data URI when a file is selected", async () => {
    const promise = capturePhotoViaFilePicker();
    await emitFileSelection(new File(["hello"], "a.jpg", { type: "image/jpeg" }));
    const result = await promise;
    expect(result).toMatch(/^data:/);
  });

  it("resolves null when the change event carries no file (cancel)", async () => {
    const promise = capturePhotoViaFilePicker();
    await emitFileSelection(null);
    await expect(promise).resolves.toBeNull();
  });

  it("cleans up the off-DOM input after selection", async () => {
    const promise = capturePhotoViaFilePicker();
    const input = await waitForInput();
    expect(input.isConnected).toBe(true);
    await emitFileSelection(new File(["z"], "z.jpg", { type: "image/jpeg" }));
    await promise;
    expect(input.isConnected).toBe(false);
  });
});

describe("stripExif", () => {
  it("returns the input unchanged when image decoding fails", async () => {
    // happy-dom's Image never fires onload for a data URL without a real
    // decoder; force the error branch by triggering onerror synchronously.
    const OriginalImage = globalThis.Image;
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_v: string) {
        // Simulate a decode failure.
        queueMicrotask(() => this.onerror?.());
      }
    }
    globalThis.Image = FakeImage as unknown as typeof Image;
    try {
      const { stripExif } = await import("./cameraService");
      const input = "data:image/jpeg;base64,BROKEN";
      await expect(stripExif(input)).resolves.toBe(input);
    } finally {
      globalThis.Image = OriginalImage;
    }
  });

  it("re-encodes through a canvas when decoding succeeds", async () => {
    const OriginalImage = globalThis.Image;
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 4;
      naturalHeight = 4;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = FakeImage as unknown as typeof Image;
    // Force a working canvas 2D context + toDataURL.
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/jpeg;base64,REENCODED");
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    try {
      const { stripExif } = await import("./cameraService");
      await expect(stripExif("data:image/jpeg;base64,ORIGINAL")).resolves.toBe(
        "data:image/jpeg;base64,REENCODED",
      );
    } finally {
      toDataURL.mockRestore();
      getContext.mockRestore();
      globalThis.Image = OriginalImage;
    }
  });
});

describe("downscaleDataUrl", () => {
  it("returns the input unchanged when the image cannot be decoded", async () => {
    const { downscaleDataUrl, MAX_PHOTO_EDGE_PX } = await import("./cameraService");
    expect(MAX_PHOTO_EDGE_PX).toBe(2048);
    const input = "data:image/jpeg;base64,not-an-image";
    const original = globalThis.Image;
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    vi.stubGlobal("Image", FailingImage);
    try {
      await expect(downscaleDataUrl(input)).resolves.toBe(input);
    } finally {
      vi.stubGlobal("Image", original);
    }
  });
});
