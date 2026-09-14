/**
 * @file agencyResolver.ts
 * @module engage-mt/map/featureCards
 * @description Agency classifier. Given a raw owner /
 *              manager / agency string (from MSDI cadastral OwnerName, the
 *              Living Atlas Public Land Ownership VTL, or any other ownership
 *              service), returns a structured match describing which agency
 *              owns the parcel, whether it is public / state-trust / tribal,
 *              what color the badge should use, and which Engage MT layer the
 *              user should toggle for the authoritative answer.
 *
 *              Precedence order is significant — FWP must beat USFWS because
 *              the substring "Wildlife" appears in both. The table is walked
 *              top-to-bottom; first match wins.
 *
 *              Mirrors the `detectPublicLand()` semantics from
 *              `js/popups/cadastral-popup.js`. Tested against every owner
 *              string we have on file plus the empty / unmatched cases.
 *
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import {
  isPrivatePropType,
  isPublicPropType,
  isStateTrust,
} from "@/components/map/featureCards/core/cadastralHelpers";

export type AgencyKey =
  | "FWP"
  | "BLM"
  | "USFS"
  | "USFWS"
  | "NPS"
  | "BOR"
  | "USACE"
  | "DOD"
  | "DNRC"
  | "MT_STATE"
  | "UNIVERSITY"
  | "TRIBAL"
  | "COUNTY"
  | "MUNICIPAL"
  | "GENERIC_PUBLIC"
  | "PRIVATE"
  | "UNDETERMINED";

/**
 * How firmly the match rests on the data: `high` when the owner string names
 * an agency, `medium` when only the property type or a structural signal did,
 * `low` when nothing could be classified.
 */
export type AgencyConfidence = "high" | "medium" | "low";

export interface AgencyMatch {
  /** Canonical agency identifier. */
  agency: AgencyKey;
  confidence: AgencyConfidence;
  /** Display label for the agency badge. */
  label: string;
  /** Plain-English "Managed for…" descriptor. */
  managedFor: string;
  isPublic: boolean;
  isTrust: boolean;
  isTribal: boolean;
  isFederal: boolean;
  isState: boolean;
  isPrivate: boolean;
  /** CSS custom property used to paint the agency chip. */
  badgeColorVar: string;
  /** Engage MT layer id the user should toggle for the authoritative answer. */
  suggestLayerId: string | null;
  /** Plain-English suggestion text. */
  suggestLabel: string;
  /** Optional external URL surfaced when no Engage MT layer covers it. */
  externalUrl?: string;
}

interface AgencyTableRow {
  key: AgencyKey;
  pattern: RegExp;
  match: Omit<AgencyMatch, "agency" | "confidence">;
}

/**
 * Agency precedence table. Walk top-to-bottom; first match wins.
 *
 * Why FWP before USFWS: cadastral OwnerName strings like "MT FWP — Wildlife
 * Management Area" contain "wildlife", which would otherwise match USFWS.
 *
 * Why DNRC before MT_STATE: DNRC parcels often read "State of Montana —
 * DNRC Trust Lands"; we want the state-trust-specific framing, not generic
 * state ownership.
 */
const AGENCY_TABLE: readonly AgencyTableRow[] = [
  {
    key: "FWP",
    pattern:
      /\b(MT\s*FWP|MONTANA\s*FWP|FISH,?\s*WILDLIFE\s*(AND|&|,)?\s*PARKS|DEPARTMENT\s*OF\s*FISH[\s,]+WILDLIFE\s*(AND|&)?\s*PARKS)\b/i,
    match: {
      label: "Montana Fish, Wildlife & Parks",
      managedFor: "Wildlife habitat, hunting, fishing, parks",
      isPublic: true,
      isTrust: false,
      isTribal: false,
      isFederal: false,
      isState: true,
      isPrivate: false,
      badgeColorVar: "--fwp-accent-hunt",
      suggestLayerId: "wma-boundaries",
      suggestLabel: "Toggle WMA boundaries for FWP-managed access.",
    },
  },
  {
    key: "BLM",
    pattern: /\b(BLM|BUREAU\s*OF\s*LAND\s*MANAGEMENT)\b/i,
    match: {
      label: "Bureau of Land Management",
      managedFor: "Multiple-use federal public land",
      isPublic: true,
      isTrust: false,
      isTribal: false,
      isFederal: true,
      isState: false,
      isPrivate: false,
      badgeColorVar: "--fwp-orange",
      suggestLayerId: "public-land-ownership",
      suggestLabel: "Toggle Public Lands for color-coded BLM / USFS / state / private context.",
      externalUrl: "https://www.blm.gov/montana-dakotas",
    },
  },
  {
    key: "USFS",
    pattern:
      /\b(USFS|U\.?\s*S\.?\s*FOREST\s*SERVICE|FOREST\s*SERVICE|USDA[\s-]*FOREST|NATIONAL\s*FOREST)\b/i,
    match: {
      label: "U.S. Forest Service",
      managedFor: "National forest — multiple-use federal land",
      isPublic: true,
      isTrust: false,
      isTribal: false,
      isFederal: true,
      isState: false,
      isPrivate: false,
      badgeColorVar: "--fwp-green-dark",
      suggestLayerId: null,
      suggestLabel: "National forest — see forest-specific regulations on fs.usda.gov.",
      externalUrl: "https://www.fs.usda.gov/r1",
    },
  },
  {
    key: "USFWS",
    // USFW / USFWS — Living Atlas VTL ships the 4-char code on some
    // layers, so accept both with a trailing-S optional alternation.
    pattern:
      /\b(USFWS?|U\.?\s*S\.?\s*FISH\s*(AND|&)\s*WILDLIFE|NATIONAL\s*WILDLIFE\s*REFUGE|WILDLIFE\s*REFUGE)\b/i,
    match: {
      label: "U.S. Fish & Wildlife Service",
      managedFor: "National Wildlife Refuge",
      isPublic: true,
      isTrust: false,
      isTribal: false,
      isFederal: true,
      isState: false,
      isPrivate: false,
      badgeColorVar: "--fwp-blue-light",
      suggestLayerId: null,
      suggestLabel: "National Wildlife Refuge — see refuge-specific regulations.",
      externalUrl: "https://www.fws.gov/refuges",
    },
  },
  {
    key: "NPS",
    pattern:
      /\b(NPS|NATIONAL\s*PARK\s*SERVICE|NATIONAL\s*PARK\b|YELLOWSTONE|GLACIER\s*NATIONAL)\b/i,
    match: {
      label: "National Park Service",
      managedFor: "National Park",
      isPublic: true,
      isTrust: false,
      isTribal: false,
      isFederal: true,
      isState: false,
      isPrivate: false,
      badgeColorVar: "--fwp-brown-raw",
      suggestLayerId: null,
      suggestLabel: "National Park — see park-specific regulations on nps.gov.",
      externalUrl: "https://www.nps.gov",
    },
  },
  {
    key: "BOR",
    // BOR / USBR — Living Atlas VTL ships "BOR" on some layers.
    pattern: /\b(USBR|BOR|BUREAU\s*OF\s*RECLAMATION|RECLAMATION)\b/i,
    match: {
      label: "Bureau of Reclamation",
      managedFor: "Federal water-project land",
      isPublic: true,
      isTrust: false,
      isTribal: false,
      isFederal: true,
      isState: false,
      isPrivate: false,
      badgeColorVar: "--fwp-blue-mid",
      suggestLayerId: null,
      suggestLabel: "Bureau of Reclamation project area — see usbr.gov.",
      externalUrl: "https://www.usbr.gov/gp",
    },
  },
  {
    key: "USACE",
    // USACE / COE — Living Atlas VTL ships "COE" on some layers.
    pattern: /\b(USACE|COE|ARMY\s*CORPS|CORPS\s*OF\s*ENGINEERS|U\.?\s*S\.?\s*ARMY\s*CORPS)\b/i,
    match: {
      label: "U.S. Army Corps of Engineers",
      managedFor: "Corps-managed land",
      isPublic: true,
      isTrust: false,
      isTribal: false,
      isFederal: true,
      isState: false,
      isPrivate: false,
      badgeColorVar: "--fwp-blue-mid",
      suggestLayerId: null,
      suggestLabel: "Corps-managed land. See usace.army.mil for the project page.",
      externalUrl: "https://www.usace.army.mil",
    },
  },
  {
    key: "DOD",
    pattern:
      /\b(DEPARTMENT\s*OF\s*DEFENSE|D\.?O\.?D\.?|MILITARY\s*RESERVATION|AIR\s*FORCE\s*BASE|MALMSTROM)\b/i,
    match: {
      label: "U.S. Department of Defense",
      managedFor: "Military installation — entry restricted",
      isPublic: false,
      isTrust: false,
      isTribal: false,
      isFederal: true,
      isState: false,
      isPrivate: false,
      badgeColorVar: "--fwp-red",
      suggestLayerId: null,
      suggestLabel: "Military land. Entry prohibited without authorization.",
    },
  },
  {
    key: "DNRC",
    // DNRC / STL — Living Atlas VTL ships "STL" (state trust land) as a
    // short code on some layers; cadastral ships the longer phrases.
    pattern:
      /\b(DNRC|STL|TRUST\s*LAND|STATE\s*TRUST|SCHOOL\s*TRUST|COMMON\s*SCHOOLS|DEPARTMENT\s*OF\s*NATURAL\s*RESOURCES\s*(AND|&)?\s*CONSERVATION)\b/i,
    match: {
      label: "Montana DNRC — Trust Lands",
      managedFor: "State trust land — recreation needs SRUL",
      isPublic: true,
      isTrust: true,
      isTribal: false,
      isFederal: false,
      isState: true,
      isPrivate: false,
      badgeColorVar: "--fwp-yellow",
      suggestLayerId: null,
      suggestLabel: "State trust land — recreation needs a Conservation License.",
      externalUrl: "https://dnrc.mt.gov/Trust-Land/Recreation",
    },
  },
  {
    // UNIVERSITY must precede MT_STATE — "Montana State University" would
    // otherwise be classified as generic state land.
    key: "UNIVERSITY",
    pattern:
      /\b(UNIVERSITY|REGENTS|MONTANA\s*STATE\s*UNIVERSITY|MSU\b|U\s*OF\s*M|MONTANA\s*TECH)\b/i,
    match: {
      label: "University System",
      managedFor: "University-managed land — research / experimental",
      isPublic: false,
      isTrust: false,
      isTribal: false,
      isFederal: false,
      isState: true,
      isPrivate: false,
      badgeColorVar: "--fwp-blue-light",
      suggestLayerId: null,
      suggestLabel: "University land. Access typically restricted — contact the institution.",
    },
  },
  {
    key: "MT_STATE",
    // STATE — Living Atlas VTL ships "STATE" as a short code; the word
    // boundary keeps "estate" / "real estate" / "interstate" from matching.
    pattern: /\b(STATE\s*OF\s*MONTANA|MONTANA\s*STATE|MT\s*DEPT|MT\s*STATE|STATE)\b/i,
    match: {
      label: "State of Montana",
      managedFor: "State-owned land",
      isPublic: true,
      isTrust: false,
      isTribal: false,
      isFederal: false,
      isState: true,
      isPrivate: false,
      badgeColorVar: "--fwp-yellow",
      suggestLayerId: null,
      suggestLabel: "State-owned parcel.",
    },
  },
  {
    key: "TRIBAL",
    pattern:
      /\b(TRIBAL|TRIBE|RESERVATION|NATION|CONFEDERATED|BLACKFEET|CROW|SALISH|KOOTENAI|ASSINIBOINE|GROS\s*VENTRE|NORTHERN\s*CHEYENNE|FORT\s*BELKNAP|FORT\s*PECK|ROCKY\s*BOY|CHIPPEWA[\s-]*CREE|LITTLE\s*SHELL)\b/i,
    match: {
      label: "Tribal jurisdiction",
      managedFor: "Tribal land — sovereign jurisdiction",
      isPublic: false,
      isTrust: false,
      isTribal: true,
      isFederal: false,
      isState: false,
      isPrivate: false,
      badgeColorVar: "--fwp-brown-raw",
      suggestLayerId: null,
      suggestLabel: "Tribal land. State + federal permits don't apply — contact the tribal office.",
    },
  },
  {
    key: "COUNTY",
    pattern: /\b(COUNTY|CTY\b)\b/i,
    match: {
      label: "County land",
      managedFor: "County-owned parcel",
      isPublic: true,
      isTrust: false,
      isTribal: false,
      isFederal: false,
      isState: false,
      isPrivate: false,
      badgeColorVar: "--fwp-neutral-500",
      suggestLayerId: null,
      suggestLabel: "County land. Contact the county clerk for use rules.",
    },
  },
  {
    key: "MUNICIPAL",
    pattern: /\b(CITY\s*OF|TOWN\s*OF|MUNICIPAL|MUNICIPALITY|CITY\s*PARK)\b/i,
    match: {
      label: "Municipal land",
      managedFor: "City / town parcel",
      isPublic: true,
      isTrust: false,
      isTribal: false,
      isFederal: false,
      isState: false,
      isPrivate: false,
      badgeColorVar: "--fwp-neutral-500",
      suggestLayerId: null,
      suggestLabel: "Municipal land. Contact the city / town for use rules.",
    },
  },
];

const PRIVATE_MATCH: Omit<AgencyMatch, "confidence"> = {
  agency: "PRIVATE",
  label: "Private land",
  managedFor: "Private ownership — permission required to enter",
  isPublic: false,
  isTrust: false,
  isTribal: false,
  isFederal: false,
  isState: false,
  isPrivate: true,
  badgeColorVar: "--fwp-orange",
  suggestLayerId: null,
  suggestLabel: "You need permission to enter. Use the Landowner Request form under Access.",
};

const GENERIC_PUBLIC_MATCH: Omit<AgencyMatch, "confidence"> = {
  agency: "GENERIC_PUBLIC",
  label: "Public land",
  managedFor: "Publicly-owned parcel — managing agency unspecified",
  isPublic: true,
  isTrust: false,
  isTribal: false,
  isFederal: false,
  isState: false,
  isPrivate: false,
  badgeColorVar: "--fwp-green-mid",
  suggestLayerId: "public-land-ownership",
  suggestLabel: "Toggle Public Lands for color-coded BLM / USFS / state / private context.",
};

/** An owner string was present but matched nothing: neither public nor confirmed private. */
const UNDETERMINED_MATCH: AgencyMatch = {
  agency: "UNDETERMINED",
  confidence: "low",
  label: "Ownership not determined",
  managedFor: "Treat as private until confirmed",
  isPublic: false,
  isTrust: false,
  isTribal: false,
  isFederal: false,
  isState: false,
  isPrivate: false,
  badgeColorVar: "--fwp-orange",
  suggestLayerId: "public-land-ownership",
  suggestLabel: "Toggle Public Lands to confirm, or check the county assessor record.",
};

/**
 * Resolve a raw owner / agency / manager string to a structured AgencyMatch.
 *
 * Walks the precedence table over the owner string (high confidence), then
 * the property type (medium). A property type that reads as public yields the
 * generic public match; one that reads as private yields the private match.
 * An owner string that matched nothing is reported as UNDETERMINED rather than
 * guessed private, so the card can show the raw owner and say so. Returns
 * null only when both inputs are empty.
 */
export function resolveAgency(
  ownerRaw: string | null | undefined,
  propType: string | null | undefined = null,
): AgencyMatch | null {
  const owner = ownerRaw && ownerRaw.length > 0 ? ownerRaw : null;
  const prop = propType && propType.length > 0 ? propType : null;

  if (owner) {
    for (const row of AGENCY_TABLE) {
      if (row.pattern.test(owner)) return { agency: row.key, confidence: "high", ...row.match };
    }
  }
  if (prop) {
    for (const row of AGENCY_TABLE) {
      if (row.pattern.test(prop)) return { agency: row.key, confidence: "medium", ...row.match };
    }
  }
  if (isStateTrust(prop, owner)) {
    const dnrc = AGENCY_TABLE.find((r) => r.key === "DNRC");
    if (dnrc) return { agency: dnrc.key, confidence: "medium", ...dnrc.match };
  }
  if (isPublicPropType(prop)) return { ...GENERIC_PUBLIC_MATCH, confidence: "medium" };
  if (isPrivatePropType(prop)) return { ...PRIVATE_MATCH, confidence: "medium" };
  if (owner || prop) return UNDETERMINED_MATCH;
  return null;
}

/**
 * Convenience: classify by a single free-text string (used by the Living
 * Atlas VTL hint card, which only ships OWNER / MANAGER / AGENCY).
 */
export function resolveAgencyFromString(raw: string | null | undefined): AgencyMatch | null {
  return resolveAgency(raw ?? null, null);
}
