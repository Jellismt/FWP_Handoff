/**
 * @file PublicLandOwnershipHintCard.tsx
 * @module engage-mt/map/featureCards
 * @description Minimal renderer for the Living Atlas Public
 *              Land Ownership VTL. Without a renderer registered the
 *              VTL fell through to GenericCard's attribute dump (the
 *              tile's raw fields). This card translates the few
 *              attributes the VTL ships into plain English + points
 *              the user at the most-specific Engage MT layer for full
 *              "Can I be here?" answers.
 *
 * The VTL is a reference layer so
 *              this card only opens when the click misses every
 *              higher-specificity polygon (state-trust, BMA,
 *              hunting districts, etc.) AND the user has the Public
 *              Land Ownership layer visible. That's the "I tapped on a
 *              yellow-colored region but nothing else was on" case.
 *
 *              `resolveAgencyHint` now delegates to the
 *              shared `agencyResolver` so the VTL hint card and the
 *              cadastral card share one source of truth. The adapter
 *              still returns null for private / unmatched / null inputs
 *              to preserve the existing test contract.
 *
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import {
  ChipRow,
  MetricCallout,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import { resolveAgency } from "@/components/map/featureCards/core/agencyResolver";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";

/**
 * Adapter that produces the hint shape ({label, suggest}).
 *
 * Returns null when:
 *  - input is null / empty
 *  - the resolver returns null (no signal)
 *  - the resolver returns a private match (the VTL doesn't show private
 *    parcels, so a "private" classification at the VTL layer is
 *    indistinguishable from "unknown" — return null and let the caller
 *    fall back to the generic "turn on a more specific layer" copy).
 */
export function resolveAgencyHint(raw: string | null): { label: string; suggest: string } | null {
  if (!raw) return null;
  const match = resolveAgency(raw, null);
  if (!match) return null;
  if (match.isPrivate || match.agency === "UNDETERMINED") return null;
  return { label: match.label, suggest: match.suggestLabel };
}

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  // The Living Atlas VTL ships either OWNER, MANAGER, AGENCY, or a
  // human-readable name string — try common keys.
  const rawAgency = str(
    get("OWNER", "Owner", "MANAGER", "Manager", "AGENCY", "Agency", "AGNCY_LEV1"),
  );
  const rawClass = str(get("CLASS", "Class", "LANDTYPE", "LandType"));
  const match = resolveAgency(rawAgency, rawClass);
  const hint = resolveAgencyHint(rawAgency ?? rawClass);
  const label = match?.label ?? rawAgency ?? rawClass ?? "Public land";

  return (
    <>
      {match && !match.isPrivate && match.agency !== "UNDETERMINED" ? (
        <MetricCallout
          title={
            match.isTribal
              ? "Tribal jurisdiction"
              : match.isTrust
                ? "State trust land"
                : "Public land"
          }
          value={label}
          sub={match.managedFor}
          intent={match.isTribal || match.isTrust ? "warning" : "success"}
        />
      ) : (
        <MetricCallout
          title="Land ownership"
          value={label}
          sub="Reference layer — tap a more specific layer for full rules"
          intent="default"
        />
      )}
      <ChipRow items={["Reference layer", "Living Atlas"]} />
      <TipBlock heading="Want the full answer?" intent="info">
        {hint?.suggest ??
          "Turn on a more specific public-land layer (BLM, USFS, State Trust, BMA) and tap again for who manages this parcel + what access rules apply."}
      </TipBlock>
    </>
  );
};

registerFeature("public-land-ownership", {
  summary: () => "Public land — reference",
  subtitle: () => "Living Atlas land ownership · reference layer",
  Body,
});
