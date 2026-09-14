/**
 * @file BmaDetail.tsx
 * @module engage-mt/access
 * @description Block Management Area detail page. Route convention
 *              `/access/bma/:id` where `:id` is the BMA's OBJECTID (or BMA_ID).
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useParams } from "react-router-dom";
import { FeatureDetailShell } from "@/components/shared/layout/FeatureDetailShell";

export const BmaDetail = (): JSX.Element => {
  const { id = "" } = useParams<{ id: string }>();
  return (
    <FeatureDetailShell
      layerId="bma-boundaries"
      rawId={id}
      where="OBJECTID = {id} OR BMA_ID = '{id}'"
      backTo="/explore"
      backLabel="Back to Explore & Access"
    />
  );
};
