/**
 * @file MyDevicePage.tsx
 * @module engage-mt/manage
 * @description Unified view of everything Engage MT has cached locally for the user:
 *              glassing waypoints, offline tile queue, dismissed messages,
 *              theme + field-mode flags. Surfaces the
 *              local-first privacy story (per docs/rules/privacy.md) and lets the
 *              user delete each bucket independently.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { prefetchProps } from "@/utils/routePrefetch";
import { ArrowRight, Trash2 } from "lucide-react";
import { PillButton } from "@/components/shared/forms/PillButton";
import { useToast } from "@/hooks/useToast";
import { supportsOfflineDownload } from "@/utils/capacitor";
import {
  offlineMaxBytes,
  formatBytes as formatTileBytes,
} from "@/services/mobile/offlineTileQuota";
import "./MyDevicePage.css";

/**
 * Read the persisted offline-areas list and sum estimated tile bytes for
 * downloaded areas. This is the on-disk tile footprint — distinct from the
 * localStorage byte count of the area metadata.
 */
const readDownloadedTileBytes = (): { bytes: number; count: number } => {
  try {
    const raw = window.localStorage?.getItem?.("engage-mt:offline-areas");
    if (!raw) return { bytes: 0, count: 0 };
    const parsed = JSON.parse(raw) as Array<{ estimatedBytes?: number; status?: string }>;
    let bytes = 0;
    let count = 0;
    for (const area of parsed) {
      if (area?.status === "downloaded") {
        bytes += typeof area.estimatedBytes === "number" ? area.estimatedBytes : 0;
        count += 1;
      }
    }
    return { bytes, count };
  } catch {
    return { bytes: 0, count: 0 };
  }
};

interface Bucket {
  key: string;
  title: string;
  description: string;
  to?: string;
  /** Count of items currently in the bucket (or null if not a counted bucket). */
  count: number | null;
  /** Approximate size in bytes (or null if not measurable). */
  bytes: number | null;
}

const STORAGE_BUCKETS: Array<Omit<Bucket, "count" | "bytes"> & { storageKey: string }> = [
  {
    key: "offline",
    storageKey: "engage-mt:offline-areas",
    title: "Offline map areas",
    description: "Areas you’ve staged for offline download.",
    to: "/manage/offline-tiles",
  },
  {
    key: "theme",
    storageKey: "engage-mt:theme",
    title: "Theme preference",
    description: "Your light / dark / system choice.",
  },
  {
    key: "field-mode",
    storageKey: "engage-mt:field-mode",
    title: "Field mode flag",
    description: "On / off for the field-optimized UI.",
  },
];

const measureBucket = (storageKey: string): Bucket["count"] | null | undefined => {
  try {
    const raw = window.localStorage?.getItem?.(storageKey);
    if (raw === null || raw === undefined) return 0;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.length;
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        return Object.keys(obj).length || 1;
      }
      return 1;
    } catch {
      return 1; // primitive string
    }
  } catch {
    return null;
  }
};

const byteSize = (storageKey: string): number | null => {
  try {
    const raw = window.localStorage?.getItem?.(storageKey);
    if (!raw) return 0;
    return new Blob([raw]).size;
  } catch {
    return null;
  }
};

const formatBytes = (b: number | null): string => {
  if (b === null) return "—";
  if (b < 1000) return `${b} B`;
  if (b < 1_000_000) return `${(b / 1000).toFixed(1)} KB`;
  return `${(b / 1_000_000).toFixed(1)} MB`;
};

export const MyDevicePage = (): JSX.Element => {
  const { show } = useToast();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // The offline-tiles bucket is a mobile-app concept (no tiles
    // are ever written on web), so it's omitted from the web planning surface.
    const visibleBuckets = supportsOfflineDownload()
      ? STORAGE_BUCKETS
      : STORAGE_BUCKETS.filter((b) => b.key !== "offline");
    const next: Bucket[] = visibleBuckets.map((b) => {
      const count = measureBucket(b.storageKey);
      return {
        key: b.key,
        title: b.title,
        description: b.description,
        to: b.to,
        count: typeof count === "number" ? count : null,
        bytes: byteSize(b.storageKey),
      };
    });
    setBuckets(next);
  }, [tick]);

  const clearBucket = (storageKey: string, title: string): void => {
    try {
      window.localStorage?.removeItem?.(storageKey);
      setTick((n) => n + 1);
      show({ kind: "success", title: `Cleared ${title}` });
    } catch {
      show({ kind: "warning", title: "Couldn’t clear that item" });
    }
  };

  const clearAll = (): void => {
    if (!window.confirm("Clear every Engage MT item on this device? This cannot be undone."))
      return;
    for (const b of STORAGE_BUCKETS) {
      try {
        window.localStorage?.removeItem?.(b.storageKey);
      } catch {
        /* noop */
      }
    }
    setTick((n) => n + 1);
    show({ kind: "info", title: "All local data cleared" });
  };

  return (
    <section className="mydevice fwp-mobile-safe-bottom">
      <div className="fwp-tool-hero" data-module="manage">
        <Link to="/manage" className="mydevice__back">
          ← Back to Manage
        </Link>
        <h1 className="fwp-tool-hero__title">My Device Data</h1>
        <p className="fwp-tool-hero__lede">
          Everything Engage MT keeps for you, in one place.{" "}
          <strong>None of it leaves this browser.</strong> Edit each bucket from its module or clear
          it here.
        </p>
      </div>

      <OfflineTileStoragePanel tick={tick} />

      <ul className="mydevice__buckets">
        {buckets.map((b) => (
          <li key={b.key} className="mydevice__bucket">
            <div className="mydevice__bucket-head">
              <div>
                <h2 className="mydevice__bucket-title">{b.title}</h2>
                <p className="mydevice__bucket-desc">{b.description}</p>
              </div>
              <div className="mydevice__bucket-meta">
                <span className="mydevice__count">
                  {b.count === null
                    ? "—"
                    : b.count === 0
                      ? "Empty"
                      : `${b.count} item${b.count === 1 ? "" : "s"}`}
                </span>
                <span className="mydevice__size">{formatBytes(b.bytes)}</span>
              </div>
            </div>
            <div className="mydevice__bucket-actions">
              {b.to && (
                <Link to={b.to}>
                  <PillButton variant="secondary" iconEnd={ArrowRight}>
                    Edit
                  </PillButton>
                </Link>
              )}
              <PillButton
                variant="secondary"
                iconStart={Trash2}
                onClick={() => {
                  const storageKey = STORAGE_BUCKETS.find((sb) => sb.key === b.key)?.storageKey;
                  if (storageKey) clearBucket(storageKey, b.title);
                }}
                disabled={!b.bytes}
              >
                Clear
              </PillButton>
            </div>
          </li>
        ))}
      </ul>

      <div className="mydevice__danger">
        <PillButton variant="danger" iconStart={Trash2} onClick={clearAll}>
          Clear all Engage MT data on this device
        </PillButton>
      </div>
    </section>
  );
};

interface OfflineTileStoragePanelProps {
  tick: number;
}

/**
 * Reads the persisted offline-areas list and surfaces the tile footprint as a
 * progress bar against the offline storage cap. Separate from the localStorage
 * bucket list because actual tile files live on the device filesystem, not in
 * localStorage — only the area metadata does.
 */
const OfflineTileStoragePanel = ({ tick }: OfflineTileStoragePanelProps): JSX.Element => {
  const [stats, setStats] = useState<{ bytes: number; count: number }>(() =>
    readDownloadedTileBytes(),
  );
  useEffect(() => {
    setStats(readDownloadedTileBytes());
  }, [tick]);
  const maxBytes = offlineMaxBytes();
  const pct = Math.min(100, Math.round((stats.bytes / maxBytes) * 100));
  return (
    <section className="mydevice__tile-storage" aria-labelledby="mydevice-tile-storage">
      <h2 id="mydevice-tile-storage" className="mydevice__tile-storage-title">
        Offline tile storage
      </h2>
      <p className="mydevice__tile-storage-meta">
        {stats.count === 0
          ? "No downloaded areas yet."
          : `${stats.count} downloaded ${stats.count === 1 ? "area" : "areas"} · ${formatTileBytes(stats.bytes)} of ${formatTileBytes(maxBytes)} cap`}
      </p>
      <div
        className="mydevice__tile-storage-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Offline tile storage usage"
      >
        <div className="mydevice__tile-storage-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="mydevice__tile-storage-note">
        Tile files live in your device&rsquo;s app storage, not in browser storage. Manage them on
        the{" "}
        <Link to="/manage/offline-tiles" {...prefetchProps("/manage/offline-tiles")}>
          Offline Maps
        </Link>{" "}
        page.
      </p>
    </section>
  );
};
