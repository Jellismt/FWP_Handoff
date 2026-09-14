/**
 * @file ExploreAccessPage.tsx
 * @module engage-mt/explore
 * @description "Explore & Access" merged landing page.
 *              One tab answers both questions — where can I go, and can I
 *              legally be there. Composes recreation tools (parks, WMAs,
 *              fishing access sites, trails) with land-tenure tools
 *              (BMA, ownership).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-15
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ModuleLandingShell } from "@/components/shared/layout/ModuleLandingShell";

export const ExploreAccessPage = (): JSX.Element => (
  <ModuleLandingShell
    module="explore"
    title="Explore & Access"
    intro="State parks, WMAs, fishing access sites, and trails — plus who owns the land and where you can legally be, parcel by parcel."
    creed={[
      { lead: "Find your place.", rest: "Parks, trails, and public lands." },
      { lead: "Get on the water.", rest: "Every FWP fishing access site, mapped." },
      { lead: "Know whose land.", rest: "Parcel by parcel, statewide." },
    ]}
    tools={[
      {
        id: "cadastral",
        title: "Public/Private Ownership",
        description:
          "Statewide cadastral parcels — tap any parcel to see the owner, mailing address, acreage, and access status.",
        to: "/?focus=mt-cadastral&intro=ownership",
      },
      {
        id: "bma",
        title: "Block Management Areas",
        description: "FWP-administered private lands open to public hunting + sign-in rules.",
        to: "/?focus=bma-boundaries&intro=bma",
      },
      {
        id: "fas",
        title: "Fishing Access Sites",
        description:
          "Every FWP fishing access site — boat ramps, bank access, amenities, and the water they open onto.",
        to: "/?focus=engage-mt:fishing-access-sites&intro=fas",
      },
      {
        id: "parks",
        title: "State Parks",
        description: "Every Montana state park with amenities, trails, hours.",
        to: "/?focus=engage-mt:state-parks&intro=state-parks",
      },
      {
        id: "wmas",
        title: "Wildlife Management Areas",
        description: "FWP-managed WMAs open for recreation.",
        to: "/?focus=engage-mt:wmas&intro=wmas",
      },
      {
        id: "trails",
        title: "Explore Trails",
        description:
          "Every mapped trail in Montana — USFS, national parks, and county systems. Tap a trail on the map for its details.",
        to: "/?focus=engage-mt:trails&intro=trails",
      },
    ]}
  />
);
