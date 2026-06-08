import { haversineKm } from '../../lib/geo.js';

// Two records describe the same physical quake if they're close in time, place and
// magnitude - used to avoid double-listing an event reported by both USGS and EMSC.
export function sameQuake(a, b) {
  if (!a || !b) return false;
  if (Math.abs(a.time - b.time) > 90000) return false;        // within 90 seconds
  if (Math.abs(a.mag - b.mag) > 1.2) return false;            // similar magnitude
  return haversineKm([a.lat, a.lng], [b.lat, b.lng]) <= 80;   // within 80 km
}

// USGS is the primary catalog; append EMSC events it doesn't already contain.
export function mergeQuakes(primary = [], extra = []) {
  const out = [...primary];
  for (const e of extra) {
    if (!out.some((p) => p.id === e.id || sameQuake(p, e))) out.push(e);
  }
  return out;
}
