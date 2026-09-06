/**
 * @file HuntPage.tsx
 * @module engage-mt/hunt
 * @description Hunt module landing page.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-15
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ModuleLandingShell } from "@/components/shared/layout/ModuleLandingShell";

export const HuntPage = (): JSX.Element => (
  <ModuleLandingShell
    module="hunt"
    title="Hunt"
    intro="Hunting districts with live FWP regulations — straight from FWP, all in one place."
    creed={[
      { lead: "Know the district.", rest: "Boundaries and seasons before you go." },
      { lead: "Know the rules.", rest: "Live regulations, straight from FWP." },
    ]}
    tools={[
      {
        id: "districts",
        title: "Hunting Districts",
        description:
          "Pick deer, elk, or antelope, search a district number, and open its report with live seasons and regulations.",
        to: "/hunt/districts",
      },
    ]}
  />
);
