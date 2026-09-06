/**
 * @file WaterbodyClosureCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for FWP waterbody restrictions & closures
 *              (fishViewer/MapServer/1) — emergency closures + drought
 *              restrictions on Montana waters. Leads with the restriction type
 *              as an intent-coded callout, then the affected reach + plain-English
 *              description, last-updated, and the FWP restrictions page.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { ExternalLink } from "lucide-react";
import {
  MetricGrid,
  MetricPill,
  Paragraph,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { LinkRow } from "@/components/map/featureCards/enrichments/LinkRow";

const RESTRICTIONS_PAGE_URL = "https://fwp.mt.gov/fish/anglingData/restrictions";

/** Named HTML entities the FWP restrictions feed actually emits. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * The FWP restrictions service stores rich text: TITLE wraps words in inline
 * HTML (e.g. a red span), and LOCATION / DESCRIPTION are peppered with
 * `&#8203;` — HTML-encoded zero-width spaces left behind by the staff editor.
 * React renders text literally, so those arrived on screen as the raw
 * "&#8203;&#8203;Bridge Road" the user saw. Strip the markup, decode the
 * entities, drop the zero-width characters, and collapse the whitespace they
 * were padding.
 *
 * Output is rendered as TEXT (never dangerouslySetInnerHTML), so decoding
 * here cannot introduce markup — React re-escapes on render.
 */
const stripHtml = (v: string | null): string | null => {
  if (!v) return null;
  const decoded = v
    .replace(/<[^>]*>/g, "")
    // Numeric entities: &#8203; (decimal) and &#x200B; (hex).
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
    // Zero-width space / non-joiner / joiner / BOM.
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Collapse the runs of whitespace the zero-width padding leaves behind.
    .replace(/\s+/g, " ")
    .trim();
  return decoded || null;
};

/** UPDATEDATE arrives as ArcGIS epoch-ms; render a short UTC date. */
const shortDate = (v: unknown): string | null => {
  const n = num(v);
  if (n !== null && n > 100_000_000_000) {
    return new Date(n).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return str(v);
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const location = stripHtml(str(get("LOCATION", "Location")));
  const description = stripHtml(str(get("DESCRIPTION", "Description")));
  const type = str(get("RESTRICTIONTYPE", "RestrictionType")) ?? "Restriction";
  const updated = shortDate(get("UPDATEDATE", "UpdateDate"));

  return (
    <>
      {/* The waterbody + restriction title are the card title now, so the
          callout that restated them is gone. */}
      <MetricGrid stack>
        {type && <MetricPill label="Type" value={type} />}
        {location && <MetricPill label="Where" value={location} />}
        {updated && <MetricPill label="Updated" value={updated} />}
      </MetricGrid>
      {description && <Paragraph>{description}</Paragraph>}
    </>
  );
};

const Enrichment = (): JSX.Element => (
  <LinkRow
    links={[
      { label: "All FWP restrictions & closures", href: RESTRICTIONS_PAGE_URL, icon: ExternalLink },
    ]}
  />
);

registerFeature("waterbody-closures", {
  // Title leads with the waterbody ("Gallatin River — Hoot Owl …") so the
  // restriction is placed at a glance; no meta strip under it.
  hideMeta: true,
  summary: (a) => {
    const wb = str(a.WATERBODY ?? a.Waterbody);
    const title = stripHtml(str(a.TITLE));
    if (wb && title) return `${wb} — ${title}`;
    return title ?? wb ?? "Waterbody closure or restriction";
  },
  Body,
  Enrichment,
});
