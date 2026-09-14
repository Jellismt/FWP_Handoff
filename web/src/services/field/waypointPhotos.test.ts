/**
 * @file waypointPhotos.test.ts
 * @module engage-mt/services/field
 * @description Guards the photo-persistence seam (F1): a photo attached to a
 *              waypoint MUST go through `persistPhoto` first so on device the
 *              durable `file://` URI is stored (not a full-res data-URI in
 *              Preferences), and the SAME id names both the store entry and the
 *              on-disk file. Removal must best-effort delete the file.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { persistPhoto, deletePhotoFile } = vi.hoisted(() => ({
  persistPhoto: vi.fn(async (id: string, _dataUri: string) => `file:///photos/${id}.jpg`),
  deletePhotoFile: vi.fn(async () => undefined),
}));
vi.mock("./photoStorage", () => ({ persistPhoto, deletePhotoFile }));

import { useFieldToolsStore } from "@/store/field/fieldToolsStore";
import { PhotoQuotaError, attachWaypointPhoto, detachWaypointPhoto } from "./waypointPhotos";

describe("waypointPhotos seam (F1)", () => {
  beforeEach(() => {
    persistPhoto.mockClear();
    deletePhotoFile.mockClear();
    useFieldToolsStore.getState().clearAll();
  });

  it("persists the photo THEN stores the returned durable URI under the same id", async () => {
    const wp = useFieldToolsStore
      .getState()
      .addWaypoint({ kind: "camp", name: "Camp", lat: 46.9, lon: -114 });
    await attachWaypointPhoto(wp.id, "data:image/jpeg;base64,AAAA");

    // persistPhoto was called with the same id that lands in the store.
    expect(persistPhoto).toHaveBeenCalledTimes(1);
    const [persistedId, dataUri] = persistPhoto.mock.calls[0]!;
    expect(dataUri).toBe("data:image/jpeg;base64,AAAA");

    const photos = useFieldToolsStore.getState().waypoints.find((w) => w.id === wp.id)!.photos;
    expect(photos).toHaveLength(1);
    expect(photos[0]!.id).toBe(persistedId);
    // The DURABLE uri is stored — never the raw data-URI.
    expect(photos[0]!.uri).toBe(`file:///photos/${persistedId}.jpg`);
    expect(photos[0]!.uri.startsWith("data:")).toBe(false);
  });

  it("detach removes the store entry AND deletes the on-disk file", async () => {
    const wp = useFieldToolsStore
      .getState()
      .addWaypoint({ kind: "camp", name: "C", lat: 46, lon: -111 });
    await attachWaypointPhoto(wp.id, "data:image/jpeg;base64,BBBB");
    const photoId = useFieldToolsStore.getState().waypoints[0]!.photos[0]!.id;

    detachWaypointPhoto(wp.id, photoId);

    expect(useFieldToolsStore.getState().waypoints[0]!.photos).toHaveLength(0);
    expect(deletePhotoFile).toHaveBeenCalledWith(photoId);
  });

  it("refuses a photo that would push the web library past its budget", async () => {
    const big = `data:image/jpeg;base64,${"A".repeat(4_000_000)}`;
    useFieldToolsStore.setState({
      waypoints: [
        {
          ...useFieldToolsStore.getState().waypoints[0],
          photos: [{ id: "p0", uri: big, capturedAt: "2026-09-06T00:00:00Z" }],
        },
      ] as never,
    });
    await expect(attachWaypointPhoto("w1", "data:image/jpeg;base64,BBBB")).rejects.toBeInstanceOf(
      PhotoQuotaError,
    );
    expect(persistPhoto).not.toHaveBeenCalled();
  });
});
