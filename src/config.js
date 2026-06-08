// Region settings shared across features.
export const REGION = {
  center: [7.08, 126.18],
  defaultUser: [7.085, 126.052],
  // Whole-Philippines query window for the feed/map.
  bbox: { minLat: 4.5, maxLat: 21.5, minLng: 116.0, maxLng: 127.0 },
  // The active Southern Mindanao aftershock zone we highlight on the map.
  highlight: { minLat: 5.0, maxLat: 8.0, minLng: 124.0, maxLng: 127.0 },
  minMagnitude: 2.5,
  alertMinMag: 4.5,
  windowDays: 7,
};
