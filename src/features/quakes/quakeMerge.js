import { haversineKm } from '../../lib/geo.js';

// Two records describe the same physical quake if they're close in time, place and
// magnitude - used to avoid double-listing an event reported by both USGS and EMSC.
export function sameQuake(a, b) {
  if (!a || !b) return false;
  if (Math.abs(a.time - b.time) > 90000) return false;        // within 90 seconds
  if (Math.abs(a.mag - b.mag) > 1.2) return false;            // similar magnitude
  return haversineKm([a.lat, a.lng], [b.lat, b.lng]) <= 80;   // within 80 km
}

export function srcOf(q) {
  return q.source === 'phivolcs' ? 'PHIVOLCS' : q.source === 'emsc' ? 'EMSC' : 'USGS';
}

// The `primary` catalog wins on value (location/magnitude); duplicates from `extra` are not
// re-listed, but the agencies that also reported the quake are consolidated into `sources` -
// so the kept value stays authoritative while showing it's corroborated.
export function mergeQuakes(primary = [], extra = []) {
  const out = primary.map((q) => ({ ...q, sources: q.sources ?? [srcOf(q)] }));
  for (const e of extra) {
    const match = out.find((p) => p.id === e.id || sameQuake(p, e));
    if (match) {
      for (const s of (e.sources ?? [srcOf(e)])) if (!match.sources.includes(s)) match.sources.push(s);
    } else {
      out.push({ ...e, sources: e.sources ?? [srcOf(e)] });
    }
  }
  return out;
}
