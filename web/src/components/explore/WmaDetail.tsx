/**
 * @file WmaDetail.tsx
 * @module engage-mt/explore
 * @description Wildlife Management Area detail page. Route convention
 *              `/explore/wma/:id` where `:id` is the WMA's OBJECTID.
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

export const WmaDetail = (): JSX.Element => {
  const { id = "" } = useParams<{ id: string }>();
  return (
    <FeatureDetailShell
      layerId="wildlife-management-areas"
      rawId={id}
      backTo="/explore"
      backLabel="Back to Explore"
    />
  );
};
