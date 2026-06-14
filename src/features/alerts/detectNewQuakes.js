// Pure detector. A quake alerts if it is above the magnitude threshold, recent (time >= sinceMs),
// and not already seen. We do NOT blanket-suppress the first batch any more: if you open the app
// within the recency window right after a quake, you SHOULD be alerted. The recency window
// (sinceMs) is what keeps old quakes from alarming on open. A coarse time+location signature
// stops the same quake re-reported by a different source (USGS vs PHIVOLCS) from alarming twice.
export function detectNewAlerts(quakes, seen, minMag, sinceMs) {
  const alerts = [];
  for (const qk of quakes) {
    const sig = `~${Math.round(qk.time / 60000)}:${qk.lat.toFixed(1)}:${qk.lng.toFixed(1)}`;
    const isNew = !seen.has(qk.id) && !seen.has(sig);
    seen.add(qk.id);
    seen.add(sig);
    if (isNew && qk.mag >= minMag && qk.time >= sinceMs) alerts.push(qk);
  }
  return alerts;
}
