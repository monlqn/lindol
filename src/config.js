// Region settings shared across features.
export const REGION = {
  center: [7.08, 126.18],
  defaultUser: [7.085, 126.052],
  // Whole-Philippines query window for the feed/map.
  bbox: { minLat: 4.5, maxLat: 21.5, minLng: 116.0, maxLng: 127.0 },
  // The active Southern Mindanao aftershock zone we highlight on the map.
  highlight: { minLat: 4.8, maxLat: 7.2, minLng: 124.0, maxLng: 126.4 },
  minMagnitude: 2.5,
  alertMinMag: 4.5,
  // Only quakes within this many km of the user trigger an alert ("near you").
  alertRadiusKm: 300,
  windowDays: 7,
};

// Voluntary donation support. The Support card only renders once gcashNumber is set,
// so nothing placeholder/fake is ever shown publicly.
export const DONATION = {
  gcashName: '',
  gcashNumber: '0910 112 8075',
  gcashQr: '/gcash-qr.png',
};
