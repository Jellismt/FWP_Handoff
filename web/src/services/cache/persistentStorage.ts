/**
 * @file persistentStorage.ts
 * @module engage-mt/services/cache
 * @description Asks the browser to treat this origin's storage as persistent
 *              so downloaded areas are not evicted under storage pressure.
 *              One request per session; browsers without the API report
 *              false.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

let pending: Promise<boolean> | null = null;

export const requestPersistentStorage = (): Promise<boolean> => {
  if (pending) return pending;
  pending = (async () => {
    try {
      const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
      if (!storage?.persist) return false;
      if (storage.persisted && (await storage.persisted())) return true;
      return await storage.persist();
    } catch {
      return false;
    }
  })();
  return pending;
};

export const resetPersistentStorageRequest = (): void => {
  pending = null;
};
