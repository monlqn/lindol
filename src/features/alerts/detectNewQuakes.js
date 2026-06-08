// Pure detector. First call (seen empty) only establishes the baseline and returns [].
export function detectNewAlerts(quakes, seen, minMag, sinceMs) {
  const baseline = seen.size === 0;
  const alerts = [];
  for (const qk of quakes) {
    const isNew = !seen.has(qk.id);
    seen.add(qk.id);
    if (baseline) continue;
    if (isNew && qk.mag >= minMag && qk.time >= sinceMs) alerts.push(qk);
  }
  return alerts;
}
