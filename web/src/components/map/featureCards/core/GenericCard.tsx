/**
 * @file GenericCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-1 default renderer — used for any layer that hasn't registered
 *              a custom Tier-2 component. Title from the layer; key/value rows from
 *              the first ~6 attributes that look useful.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { KeyValueRow } from "@/components/map/featureCards/core/cardPrimitives";
import type {
  FeatureRenderer,
  FeatureRendererProps,
} from "@/components/map/featureCards/core/types";

const SKIP_KEYS = new Set(["OBJECTID", "OBJECTID_1", "Shape__Area", "Shape__Length", "GlobalID"]);

const prettifyKey = (k: string): string =>
  k
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
};

const GenericBody = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const entries = Object.entries(attrs).filter(([k, v]) => {
    if (SKIP_KEYS.has(k)) return false;
    if (v === null || v === undefined || v === "") return false;
    return true;
  });
  const rows = entries.slice(0, 6);
  if (rows.length === 0) {
    return <p className="feature-paragraph">No attributes returned for this feature.</p>;
  }
  return (
    <>
      {rows.map(([k, v]) => (
        <KeyValueRow key={k} label={prettifyKey(k)} value={formatValue(v)} />
      ))}
    </>
  );
};

const summarize = (attrs: Record<string, unknown>, fallback: string): string => {
  for (const k of ["NAME", "Name", "name", "TITLE", "title", "LABEL", "Label"]) {
    const v = attrs[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return fallback;
};

/** The Tier-1 fallback renderer. Not registered; used when registry has no entry. */
export const genericRenderer = (layerTitle: string): FeatureRenderer => ({
  summary: (a) => summarize(a, layerTitle),
  Body: GenericBody,
});
