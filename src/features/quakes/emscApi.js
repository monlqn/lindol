const BASE = 'https://www.seismicportal.eu/fdsnws/event/1/query';

// Build an EMSC (SeismicPortal) FDSN query - a second, independent realtime source
// alongside USGS, using the same bbox + recency window so results merge cleanly.
export function buildEmscUrl(region) {
  const { bbox, minMagnitude, windowDays } = region;
  const start = new Date(Date.now() - windowDays * 86400000).toISOString();
  const p = new URLSearchParams({
    format: 'json',
    starttime: start,
    minlatitude: String(bbox.minLat),
    maxlatitude: String(bbox.maxLat),
    minlongitude: String(bbox.minLng),
    maxlongitude: String(bbox.maxLng),
    minmagnitude: String(minMagnitude),
    orderby: 'time',
    limit: '500',
  });
  return `${BASE}?${p.toString()}`;
}

// EMSC real-time WebSocket endpoint - pushes new/updated quakes the instant they're detected.
export const EMSC_WS_URL = 'wss://www.seismicportal.eu/standing_order/websocket';

// Normalize a single EMSC WebSocket message ({ action, data: Feature }) into our Quake shape.
// Same id scheme as parseEmscQuakes so a pushed event dedupes against the polled feed.
export function parseEmscWsEvent(msg) {
  const d = msg && msg.data;
  if (!d || !d.properties) return null;
  const pr = d.properties;
  const coords = d.geometry?.coordinates ?? [];
  const lat = Number(pr.lat ?? coords[1]);
  const lng = Number(pr.lon ?? coords[0]);
  const mag = Number(pr.mag);
  const time = typeof pr.time === 'string' ? Date.parse(pr.time) : pr.time;
  if (![lat, lng, mag, time].every(Number.isFinite)) return null;
  return {
    id: `emsc:${pr.unid || pr.source_id || d.id}`,
    mag,
    place: pr.flynn_region || pr.region || 'Unknown location',
    time,
    depthKm: coords[2] ?? pr.depth ?? null,
    lat,
    lng,
    source: 'emsc',
  };
}

// Normalize an EMSC GeoJSON FeatureCollection into the same Quake shape as USGS.
export function parseEmscQuakes(geojson) {
  const features = geojson && Array.isArray(geojson.features) ? geojson.features : [];
  return features
    .filter((f) => f && f.properties && typeof f.properties.mag === 'number')
    .map((f) => {
      const pr = f.properties;
      const coords = f.geometry?.coordinates ?? [];
      return {
        id: `emsc:${pr.unid || pr.source_id || f.id}`,
        mag: pr.mag,
        place: pr.flynn_region || pr.region || 'Unknown location',
        time: typeof pr.time === 'string' ? Date.parse(pr.time) : pr.time,
        depthKm: coords[2] ?? pr.depth ?? null,
        lat: coords[1] ?? pr.lat,
        lng: coords[0] ?? pr.lon,
        source: 'emsc',
      };
    })
    .filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng) && Number.isFinite(q.time));
}
