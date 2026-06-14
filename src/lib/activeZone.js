import { haversineKm } from './geo.js';

// Andrew's monotone-chain convex hull. Input and output are [lat, lng] points.
export function convexHull(latlngs) {
  if (latlngs.length < 3) return latlngs.slice();
  // work in [x=lng, y=lat]
  const pts = latlngs.map(([lat, lng]) => [lng, lat]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  return hull.map(([x, y]) => [y, x]); // back to [lat, lng]
}

// Ray-casting point-in-polygon test. point and polygon vertices are [lat, lng].
export function pointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) return false;
  const [lat, lng] = point;
  const x = lng;
  const y = lat;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1];
    const yi = polygon[i][0];
    const xj = polygon[j][1];
    const yj = polygon[j][0];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Build the active-zone polygon from real epicentres: keep points near the cluster centre
// (drop far outliers, e.g. an unrelated quake elsewhere), hull them, then pad each vertex
// outward from the centroid so the zone has a little visual margin. Returns [lat,lng][] or null.
export function activeZone(quakes, center, { maxKm = 130, pad = 1.12, minPoints = 5 } = {}) {
  if (!Array.isArray(quakes) || !center) return null;
  const pts = quakes
    .filter((q) => q && Number.isFinite(q.lat) && Number.isFinite(q.lng))
    .filter((q) => haversineKm(center, [q.lat, q.lng]) <= maxKm)
    .map((q) => [q.lat, q.lng]);
  if (pts.length < minPoints) return null;
  const hull = convexHull(pts);
  if (hull.length < 3) return null;
  const cLat = hull.reduce((s, p) => s + p[0], 0) / hull.length;
  const cLng = hull.reduce((s, p) => s + p[1], 0) / hull.length;
  return hull.map(([lat, lng]) => [cLat + (lat - cLat) * pad, cLng + (lng - cLng) * pad]);
}
