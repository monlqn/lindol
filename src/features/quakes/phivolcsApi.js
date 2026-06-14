// PHIVOLCS events come from our own serverless scraper at /api/phivolcs (see api/phivolcs.js),
// which returns the same Quake shape as USGS/EMSC so everything merges cleanly. PHIVOLCS is
// the local authority for PH seismicity, so it's the preferred source for events here.
export function buildPhivolcsUrl(region) {
  const { windowDays, minMagnitude } = region;
  const p = new URLSearchParams({ days: String(windowDays), min: String(minMagnitude) });
  return `/api/phivolcs?${p.toString()}`;
}

export function parsePhivolcsQuakes(json) {
  const arr = json && Array.isArray(json.quakes) ? json.quakes : [];
  return arr.filter((q) => q
    && Number.isFinite(q.lat) && Number.isFinite(q.lng)
    && Number.isFinite(q.time) && Number.isFinite(q.mag));
}
