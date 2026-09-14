/**
 * @file UsfsRecCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for USFS recreation sites,
 *              now harmonized with BlmRecCard + BorRecCard so the three
 *              cards under the `federal-recreation-sites` composite read
 *              as one design language. Slot order locked across all
 *              three; USFS happens to fill the most slots because the
 *              upstream service is the richest.
 *
 *              FWP-via-USFS MapServer schema (probed Jun 5):
 *
 *                OBJECTID, RECAREANAME, RECAREAURL, FORESTNAME,
 *                RESERVATION_INFO, RECAREADESCRIPTION (HTML),
 *                ACCESSIBILITY
 *
 *              Shared slot order:
 *
 *                1. MetricCallout — site name + reservation status + agency sub
 *                2. DomainPill row — National Forest
 *                3. MetricGrid amenity pills — Accessibility
 *                4. Description Paragraph — HTML-stripped RECAREADESCRIPTION
 *                5. TipBlock — reservation details + USFS site rules
 *                6. Link enrichment (Forest Service page + Directions)
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-07-14
 * @version 2.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import {
  HeroBlock,
  MetricGrid,
  MetricPill,
  Paragraph,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";

const USFS_R1_URL = "https://www.fs.usda.gov/r1";

/** Strip simple HTML for safe display. The service often sends
 *  <p>... </p> wrapped descriptions; we want plain text. */
const stripHtml = (html: string | null): string | null => {
  if (!html) return null;
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
};

/** Classify the reservation status from RESERVATION_INFO prose. */
const reservationStatus = (
  v: string | null,
): { value: string; intent: "success" | "warning" | "default" } => {
  if (!v) return { value: "Check forest page", intent: "default" };
  const low = v.toLowerCase();
  if (/no reservations|first come|first-come|fcfs/i.test(low)) {
    return { value: "First come, first served", intent: "success" };
  }
  if (/reservations? (are )?(required|recommended)|reserve at/i.test(low)) {
    return { value: "Reservations recommended", intent: "warning" };
  }
  if (/reservations? (are )?(taken|accepted|available)|recreation\.gov/i.test(low)) {
    return { value: "Reservations available", intent: "warning" };
  }
  return { value: "Check reservation status", intent: "default" };
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const forest = str(get("FORESTNAME", "ForestName", "FOREST_NAME"));
  const resInfo = str(get("RESERVATION_INFO", "ReservationInfo"));
  const description = stripHtml(str(get("RECAREADESCRIPTION", "Description", "DESCRIPTION")));
  const accessibility = str(get("ACCESSIBILITY", "Accessibility"));

  const reservation = reservationStatus(resInfo);

  return (
    <>
      <HeroBlock caption="USDA Forest Service" value={reservation.value} />
      {(forest || accessibility) && (
        <MetricGrid stack>
          {forest && <MetricPill label="National Forest" value={forest} />}
          {accessibility && (
            <MetricPill
              label="Accessibility"
              value={accessibility.length > 30 ? "Yes (see notes)" : accessibility}
            />
          )}
        </MetricGrid>
      )}
      {description && <Paragraph>{description}</Paragraph>}
      {resInfo && (
        <TipBlock heading="Reservation details" intent="info">
          {resInfo}
        </TipBlock>
      )}
      <TipBlock heading="USFS site rules" intent="info">
        Most developed USFS campgrounds limit stays to <strong>14 days</strong>; dispersed sites cap
        at 14 days then a 25 mi move. Wilderness areas prohibit motorized travel and cap group size
        (typically 15). Confirm conditions via the official forest page or{" "}
        <a href={USFS_R1_URL} target="_blank" rel="noreferrer">
          fs.usda.gov/r1
        </a>{" "}
        before heading out.
      </TipBlock>
    </>
  );
};

registerFeature("usfs-recreation-sites", {
  summary: (a) => String(a.RECAREANAME ?? a.NAME ?? a.Name ?? "USFS recreation site"),
  subtitle: () => "USDA Forest Service · Montana",
  Body,
  // Auto-takeover on single click. RESERVATION_INFO + the
  // HTML description can be long; takeover gives them breathing room.
});
