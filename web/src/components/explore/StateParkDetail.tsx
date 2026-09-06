/**
 * @file StateParkDetail.tsx
 * @module engage-mt/explore
 * @description Montana State Park detail page. Route convention
 *              `/explore/park/:id` where `:id` is the park's OBJECTID.
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

export const StateParkDetail = (): JSX.Element => {
  const { id = "" } = useParams<{ id: string }>();
  return (
    <FeatureDetailShell
      layerId="state-parks"
      rawId={id}
      backTo="/explore"
      backLabel="Back to Explore"
    />
  );
};
