/**
 * @file regionContacts.ts
 * @module engage-mt/services/hunt
 * @description Static lookup of the seven FWP regional office contacts. FWP
 *              does not publish individual biologist phones; the documented
 *              FWP guidance is "call the regional office and ask for the
 *              biologist." This module is
 *              that lookup — name, phone, address, and the canonical
 *              fwp.mt.gov office URL — so any contact UI can wire a
 *              copy-friendly phone and a directions-friendly address
 *              without hand-typing them per page.
 *
 *              Region centroids are approximate office coordinates, used
 *              by the Hunting Districts browser's "Show on map" action so
 *              tapping a district roughly recenters the map on the right
 *              corner of the state. Per-district polygon centroids would
 *              be better; the region centroid is the best we can do until
 *              the district-facts dataset carries lat/lon.
 *
 *              Data is publicly listed at fwp.mt.gov/aboutfwp/regional-
 *              offices and carries no PII — this is not stub data.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-17
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export interface RegionContact {
  /** Region number 1..7. */
  region: number;
  /** Short region name ("Northwest", "Central", "Southeast", …). */
  name: string;
  /** City the regional office is in. */
  city: string;
  /** Single-line mailing address. */
  address: string;
  /** Phone — published, FWP front-desk line. */
  phone: string;
  /** `tel:` URI for click-to-call. */
  phoneHref: string;
  /** FWP office page URL. */
  url: string;
  /** Approximate centroid of the region (office coordinates). */
  centroid: { lat: number; lon: number };
}

/**
 * Source: fwp.mt.gov/aboutfwp/regional-offices (probed 2026-06-06).
 * Phones reflect the published FWP front-desk numbers; addresses are
 * verbatim from FWP's office page. Region centroids approximate the
 * office city — close enough for an initial map-recenter on districts
 * that don't yet carry a per-district lat/lon in district-facts.
 */
export const FWP_REGIONS: readonly RegionContact[] = [
  {
    region: 1,
    name: "Northwest",
    city: "Kalispell",
    address: "490 N Meridian Rd, Kalispell, MT 59901",
    phone: "(406) 752-5500",
    phoneHref: "tel:+14067525500",
    url: "https://fwp.mt.gov/aboutfwp/regional-offices/region1",
    centroid: { lat: 48.197, lon: -114.314 },
  },
  {
    region: 2,
    name: "West-Central",
    city: "Missoula",
    address: "3201 Spurgin Rd, Missoula, MT 59804",
    phone: "(406) 542-5500",
    phoneHref: "tel:+14065425500",
    url: "https://fwp.mt.gov/aboutfwp/regional-offices/region2",
    centroid: { lat: 46.853, lon: -114.078 },
  },
  {
    region: 3,
    name: "Southwest",
    city: "Bozeman",
    address: "1400 S 19th Ave, Bozeman, MT 59718",
    phone: "(406) 577-7900",
    phoneHref: "tel:+14065777900",
    url: "https://fwp.mt.gov/aboutfwp/regional-offices/region3",
    centroid: { lat: 45.659, lon: -111.071 },
  },
  {
    region: 4,
    name: "North-Central",
    city: "Great Falls",
    address: "4600 Giant Springs Rd, Great Falls, MT 59405",
    phone: "(406) 454-5840",
    phoneHref: "tel:+14064545840",
    url: "https://fwp.mt.gov/aboutfwp/regional-offices/region4",
    centroid: { lat: 47.539, lon: -111.226 },
  },
  {
    region: 5,
    name: "South-Central",
    city: "Billings",
    address: "2300 Lake Elmo Dr, Billings, MT 59105",
    phone: "(406) 247-2940",
    phoneHref: "tel:+14062472940",
    url: "https://fwp.mt.gov/aboutfwp/regional-offices/region5",
    centroid: { lat: 45.821, lon: -108.443 },
  },
  {
    region: 6,
    name: "Northeast",
    city: "Glasgow",
    address: "1 Airport Rd, Glasgow, MT 59230",
    phone: "(406) 228-3700",
    phoneHref: "tel:+14062283700",
    url: "https://fwp.mt.gov/aboutfwp/regional-offices/region6",
    centroid: { lat: 48.211, lon: -106.625 },
  },
  {
    region: 7,
    name: "Southeast",
    city: "Miles City",
    address: "352 I-94 Business Loop, Miles City, MT 59301",
    phone: "(406) 234-0900",
    phoneHref: "tel:+14062340900",
    url: "https://fwp.mt.gov/aboutfwp/regional-offices/region7",
    centroid: { lat: 46.408, lon: -105.84 },
  },
] as const;

const REGION_INDEX = new Map<number, RegionContact>(FWP_REGIONS.map((r) => [r.region, r]));

/** Returns the contact record for region 1..7, or null when out of range. */
export const resolveRegionContact = (
  region: number | string | null | undefined,
): RegionContact | null => {
  if (region === null || region === undefined) return null;
  const n = typeof region === "number" ? region : Number(region);
  if (!Number.isFinite(n)) return null;
  return REGION_INDEX.get(n) ?? null;
};
