/**
 * @file connectivityStore.ts
 * @module engage-mt/store
 * @description Connectivity awareness for the app shell. On web, listens to
 *              window.online / window.offline events; on Capacitor, listens to
 *              @capacitor/network plugin events (dynamically imported per
 *). Consumers read `useConnectivityStore` to know whether
 *              the device currently has network so they can swap to cached
 *              snapshots / offline tiles / "Offline" inline notices.
 *
 *              Privacy: no connectivity events are ever transmitted. The value
 *              is observed locally and stays in memory.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-07
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import { isCapacitor } from "@/utils/capacitor";

export type ConnectivityKind = "wifi" | "cellular" | "ethernet" | "vpn" | "none" | "unknown";

interface ConnectivityState {
  online: boolean;
  kind: ConnectivityKind;
  /** Updated every time online flips. Useful for "Last seen online 5m ago" UX. */
  lastChangedAt: number | null;
  setOnline: (online: boolean, kind?: ConnectivityKind) => void;
}

const initialOnline = typeof navigator !== "undefined" ? navigator.onLine !== false : true;

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  online: initialOnline,
  kind: initialOnline ? "unknown" : "none",
  lastChangedAt: null,
  setOnline: (online, kind) =>
    set((prev) => ({
      online,
      kind: kind ?? (online ? (prev.kind === "none" ? "unknown" : prev.kind) : "none"),
      lastChangedAt: prev.online === online ? prev.lastChangedAt : Date.now(),
    })),
}));

/** Direct accessor for non-React callers (e.g., the offline tile resolver). */
export const isOnline = (): boolean => useConnectivityStore.getState().online;

let installed = false;

interface NetworkPluginStatus {
  connected: boolean;
  connectionType?: string;
}

interface NetworkPlugin {
  getStatus: () => Promise<NetworkPluginStatus>;
  addListener: (
    event: string,
    cb: (status: NetworkPluginStatus) => void,
  ) => Promise<{ remove: () => Promise<void> }> | { remove: () => void };
}

const mapKind = (raw: string | undefined): ConnectivityKind => {
  switch (raw) {
    case "wifi":
      return "wifi";
    case "cellular":
      return "cellular";
    case "ethernet":
      return "ethernet";
    case "vpn":
      return "vpn";
    case "none":
      return "none";
    default:
      return "unknown";
  }
};

/**
 * Wire the store to platform events. Idempotent — calling twice is a no-op.
 * Mount once from App.tsx (or a root provider). Returns a teardown function
 * for unit-test cleanup; production callers can ignore the return.
 */
export const installConnectivityListeners = (): (() => void) => {
  if (installed) return () => undefined;
  installed = true;

  const teardowns: Array<() => void> = [];

  // Web fallback — navigator.onLine + window events.
  if (typeof window !== "undefined") {
    const onOnline = (): void => useConnectivityStore.getState().setOnline(true);
    const onOffline = (): void => useConnectivityStore.getState().setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    teardowns.push(() => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    });
  }

  // Capacitor enhancement — @capacitor/network for connectionType info.
  if (isCapacitor()) {
    void (async () => {
      try {
        // Literal import — @capacitor/network is a web dep, so Vite bundles it
        // into a lazy chunk that resolves natively. A @vite-ignore'd variable
        // import leaves an unresolvable bare specifier → the native
        // networkStatusChange listener never attaches (connectionType detail is
        // lost; the base online/offline still works via the window listeners above).
        const mod = (await import("@capacitor/network")) as unknown as {
          Network: NetworkPlugin;
        };
        const { Network } = mod;
        const status = await Network.getStatus();
        useConnectivityStore.getState().setOnline(status.connected, mapKind(status.connectionType));
        const handle = await Network.addListener("networkStatusChange", (next) => {
          useConnectivityStore.getState().setOnline(next.connected, mapKind(next.connectionType));
        });
        teardowns.push(() => {
          if (handle && typeof handle.remove === "function") {
            void handle.remove();
          }
        });
      } catch {
        // @capacitor/network not installed — web listeners suffice.
      }
    })();
  }

  return () => {
    teardowns.forEach((fn) => fn());
    installed = false;
  };
};
