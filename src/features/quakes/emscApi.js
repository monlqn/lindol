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
