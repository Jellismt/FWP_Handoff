/**
 * @file WalletNotice.tsx
 * @module engage-mt/shared
 * @description Cross-module wallet affordance. If the user has a license of a kind
 *              relevant to the current tab, render a top-of-tab notice. Per
 *              the wallet sign-in affordance set (surface 1).
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Link } from "react-router-dom";
import { CalciteNotice } from "@esri/calcite-components-react";
import type { EngageMtModule } from "@/types/layers";
import { useWallet } from "@/hooks/useWallet";

const relevantLicenseFor = (module: EngageMtModule, type: string): boolean => {
  const lower = type.toLowerCase();
  if (module === "fish") return lower.includes("fish") || lower.includes("conservation");
  if (module === "hunt")
    return (
      lower.includes("hunt") ||
      lower.includes("big game") ||
      lower.includes("conservation") ||
      lower.includes("upland")
    );
  return false;
};

interface Props {
  module: EngageMtModule;
}

export const WalletNotice = ({ module }: Props): JSX.Element | null => {
  const { isSignedIn, licenses, eTags } = useWallet();
  if (!isSignedIn) return null;
  const relevant = licenses.filter((l) => relevantLicenseFor(module, l.type));
  const tags = module === "hunt" ? eTags : [];
  if (relevant.length === 0 && tags.length === 0) return null;

  // Calcite 5 narrowed `icon` to a strict IconName union; "id-card" is
  // a valid Calcite icon but the React wrapper's bundled types don't
  // re-export the alias. Cast to satisfy tsc.
  return (
    <CalciteNotice open icon="license" kind="brand" scale="m">
      <div slot="title">
        {relevant.length > 0
          ? relevant.map((l) => l.type).join(" · ")
          : `${tags.length} tag${tags.length === 1 ? "" : "s"} loaded`}
      </div>
      <div slot="message">
        <Link to="/manage">View wallet</Link>
      </div>
    </CalciteNotice>
  );
};
