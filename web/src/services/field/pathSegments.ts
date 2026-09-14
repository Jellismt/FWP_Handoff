/**
 * @file pathSegments.ts
 * @module engage-mt/services/field
 * @description Splits a recorded path into its continuous segments. A track
 *              stores one flat sample array plus the index where each segment
 *              starts; the map and the GPX writer draw each segment on its
 *              own so a recording gap is never bridged by a straight line.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** Normalised, sorted, in-range segment starts, always beginning at 0. */
export const normalizeSegments = (length: number, segments?: readonly number[]): number[] => {
  const starts = new Set<number>([0]);
  for (const s of segments ?? []) {
    if (Number.isInteger(s) && s > 0 && s < length) starts.add(s);
  }
  return [...starts].sort((a, b) => a - b);
};

/** The path split at its segment starts; single-point segments are kept. */
export const splitPath = <P>(path: readonly P[], segments?: readonly number[]): P[][] => {
  const starts = normalizeSegments(path.length, segments);
  return starts.map((start, i) => path.slice(start, starts[i + 1] ?? path.length));
};

/** True when index `i` begins a new segment (the link from `i - 1` is a gap). */
export const isSegmentStart = (i: number, segments?: readonly number[]): boolean =>
  i > 0 && (segments ?? []).includes(i);
