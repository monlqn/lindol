// The headline "latest major quake": the most recent event (by origin time) at or above the
// given magnitude. Pure; returns null when nothing in the feed qualifies. The pinned M7.8 anchor
// is always present in the feed, so this naturally falls back to it until a newer major quake hits.
export function latestMajor(quakes = [], minMag) {
  let best = null;
  for (const q of quakes) {
    if (q && q.mag >= minMag && (best === null || q.time > best.time)) best = q;
  }
  return best;
}
