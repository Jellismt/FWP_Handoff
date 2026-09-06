/**
 * @file year.ts
 * @module engage-mt/services/regsApi
 * @description The season year governing "today" for regs-API queries. The Montana
 *              license year runs Mar 1 – end of Feb (the 2026 book is adopted "valid
 *              Mar 1 2026 – Feb 28 2027"), so in January/February the PREVIOUS calendar
 *              year's book still governs.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-14
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** Season year for a given date (defaults to now): calendar year, minus one in Jan/Feb. */
export function currentRegsYear(today: Date = new Date()): number {
  const JAN = 0;
  const FEB = 1;
  const m = today.getMonth();
  return m === JAN || m === FEB ? today.getFullYear() - 1 : today.getFullYear();
}

/**
 * The statutory MT license-year window for a season: Mar 1 of `year` through the
 * end of February of `year + 1`. These dates are fixed by the license-year
 * definition (not a guess), so they're authoritative even when a live API
 * response omits them — used to give live/cached regs the same dated
 * "Effective {date}" freshness chip the bundled snapshot carries.
 */
export function seasonWindow(year: number): { effectiveDate: string; validUntil: string } {
  // Feb has 29 days when year+1 is a leap year, else 28.
  const nextYear = year + 1;
  const isLeap = nextYear % 4 === 0 && (nextYear % 100 !== 0 || nextYear % 400 === 0);
  const lastFeb = isLeap ? 29 : 28;
  return {
    effectiveDate: `${year}-03-01`,
    validUntil: `${nextYear}-02-${lastFeb}`,
  };
}
