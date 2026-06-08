// Great-circle distance between two [lat, lng] points, in kilometers.
export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Human-readable distance: one decimal under 10 km, whole km otherwise.
export function formatKm(km) {
  const n = km < 10 ? km.toFixed(1) : Math.round(km).toString();
  return `${n} km`;
}
