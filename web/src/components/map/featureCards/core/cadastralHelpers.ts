/**
 * @file cadastralHelpers.ts
 * @module engage-mt/map/featureCards
 * @description Pure helpers used by CadastralCard. Extracted
 *              so React Fast Refresh stays clean (component files can
 *              only export components) and so the parcel-classification
 *              predicates have a unit-test surface.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** True when the property type indicates publicly-owned land. */
export function isPublicPropType(propType: string | null): boolean {
  if (!propType) return false;
  return /exempt|public|federal|state|county|city|municipal/i.test(propType);
}

/** True when the property type says outright that the parcel is privately owned. */
export function isPrivatePropType(propType: string | null): boolean {
  if (!propType) return false;
  return /private|residential|agricultural|commercial|industrial|farmstead|vacant/i.test(propType);
}

/**
 * True when the parcel's property type or owner string identifies it as
 * state-trust land managed by DNRC. Drives the SRUL TipBlock + "Buy an
 * SRUL" pill in CadastralCard.
 */
export function isStateTrust(propType: string | null, ownerName: string | null): boolean {
  const haystack = `${propType ?? ""} ${ownerName ?? ""}`.toLowerCase();
  return (
    haystack.includes("dnrc") ||
    haystack.includes("trust land") ||
    haystack.includes("state trust") ||
    /state of montana/.test(haystack)
  );
}
