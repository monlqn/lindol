const BASE = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

// Build a USGS FDSN query URL for the region's bounding box + recency window.
export function buildUsgsUrl(region) {
  const { bbox, minMagnitude, windowDays } = region;
  const start = new Date(Date.now() - windowDays * 86400000).toISOString();
  const p = new URLSearchParams({
    format: 'geojson',
    starttime: start,
    minlatitude: String(bbox.minLat),
    maxlatitude: String(bbox.maxLat),
    minlongitude: String(bbox.minLng),
    maxlongitude: String(bbox.maxLng),
    minmagnitude: String(minMagnitude),
    orderby: 'time',
  });
  return `${BASE}?${p.toString()}`;
}

// Normalize a USGS GeoJSON FeatureCollection into Quake[].
export function parseQuakes(geojson) {
  const features = geojson && Array.isArray(geojson.features) ? geojson.features : [];
  return features
    .filter((f) => f && f.properties && typeof f.properties.mag === 'number')
    .map((f) => ({
      id: f.id,
      mag: f.properties.mag,
      place: f.properties.place || 'Unknown location',
      time: f.properties.time,
      depthKm: f.geometry?.coordinates?.[2] ?? null,
      lat: f.geometry?.coordinates?.[1],
      lng: f.geometry?.coordinates?.[0],
    }))
    // Mirror the EMSC/PHIVOLCS parsers: never let NaN/undefined coords or time into the merged feed.
    .filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng) && Number.isFinite(q.time) && Number.isFinite(q.mag));
}
