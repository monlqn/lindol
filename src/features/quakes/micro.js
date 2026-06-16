import { REGION } from '../../config.js';

// "Micro" quakes are below the feed minimum (M2.0): instrument-only, not felt, PHIVOLCS-only.
// Derived rather than tagged, so the Quake shape stays uniform and merge/classify logic is untouched.
export const isMicro = (q, region = REGION) => q.mag < region.minMagnitude;

// Split a feed into micro (<minMagnitude) vs main (>=minMagnitude) counts, for honest headline copy
// (micro is a recent short-window feature, the main feed spans the full window).
export function splitMicro(quakes = [], region = REGION) {
  let microCount = 0;
  for (const q of quakes) if (q.mag < region.minMagnitude) microCount += 1;
  return { microCount, mainCount: quakes.length - microCount };
}
