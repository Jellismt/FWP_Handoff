/**
 * @file manifest.ts
 * @module engage-mt/services/data
 * @description Typed loader for the bundled data manifest
 *              (`/data/data-manifest.json`): what each bundled dataset is,
 *              where it came from, when it took effect and expires, and its
 *              provenance tier. Loaded once per session.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { fetchJson } from "@/utils/http";

export type ProvenanceTier = "demo-fixture" | "extracted" | "authoritative";

export interface DatasetManifestEntry {
  id: string;
  file: string;
  format: string;
  schemaVersion: string;
  effectiveDate: string;
  expiresDate?: string;
  rowCount: number;
  sizeBytes: number;
  sha256: string;
  source: string;
  provenanceTier: ProvenanceTier;
  license: string;
  upstreamUrl?: string;
}

export interface DataManifest {
  version: string;
  generatedAt: string;
  manifestSchemaVersion: string;
  appVersion: string;
  datasets: DatasetManifestEntry[];
}

export const MANIFEST_URL = "/data/data-manifest.json";
const DAY_MS = 86_400_000;

let pending: Promise<DataManifest> | null = null;

export const fetchDataManifest = (): Promise<DataManifest> => {
  pending ??= fetchJson<DataManifest>(MANIFEST_URL);
  return pending;
};

export const resetDataManifest = (): void => {
  pending = null;
};

/** True once the day after `expiresDate` has begun. */
export const isDatasetExpired = (
  entry: Pick<DatasetManifestEntry, "expiresDate">,
  now: Date = new Date(),
): boolean => {
  if (!entry.expiresDate) return false;
  const expires = Date.parse(entry.expiresDate);
  return Number.isFinite(expires) && expires + DAY_MS <= now.getTime();
};

export const TIER_LABEL: Record<ProvenanceTier, string> = {
  "demo-fixture": "Demo fixture",
  extracted: "Extracted from an authoritative source",
  authoritative: "Authoritative",
};

interface ManifestEntryState {
  entry: DatasetManifestEntry | null;
  loading: boolean;
  expired: boolean;
}

export const useDatasetManifestEntry = (id: string): ManifestEntryState => {
  const [state, setState] = useState<ManifestEntryState>({
    entry: null,
    loading: true,
    expired: false,
  });
  useEffect(() => {
    let alive = true;
    fetchDataManifest()
      .then((m) => {
        if (!alive) return;
        const entry = m.datasets.find((d) => d.id === id) ?? null;
        setState({ entry, loading: false, expired: entry ? isDatasetExpired(entry) : false });
      })
      .catch(() => {
        if (alive) setState({ entry: null, loading: false, expired: false });
      });
    return () => {
      alive = false;
    };
  }, [id]);
  return state;
};
