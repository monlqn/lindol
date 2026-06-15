import { sameQuake } from '../quakes/quakeMerge.js';

// Pure detector. A quake alerts if it is above the magnitude threshold, recent (time >= sinceMs),
// and not one we've already alarmed for. Two things keep the same event from alarming twice:
//   - `seen` holds the ids + a coarse time/location signature of quakes we've alerted on (cheap,
//     exact dedup for the same record re-reported by the same source).
//   - `alerted` holds the actual records we've alarmed for, so the SAME physical quake re-reported
//     under a different id (e.g. PHIVOLCS superseding EMSC in the merged feed, with a shifted
//     epicentre/time) is caught by sameQuake matching even when the coarse signature differs.
// Crucially, a quake is only marked seen once it actually qualifies, so a preliminary report that
// lands below the threshold and is later revised upward can still alarm.
export function detectNewAlerts(quakes, seen, minMag, sinceMs, alerted = []) {
  const fresh = [];
  for (const qk of quakes) {
    if (!(qk.mag >= minMag && qk.time >= sinceMs)) continue;
    const sig = `~${Math.round(qk.time / 60000)}:${qk.lat.toFixed(1)}:${qk.lng.toFixed(1)}`;
    if (seen.has(qk.id) || seen.has(sig)) continue;
    if (alerted.some((a) => sameQuake(a, qk)) || fresh.some((f) => sameQuake(f, qk))) continue;
    seen.add(qk.id);
    seen.add(sig);
    fresh.push(qk);
  }
  return fresh;
}
