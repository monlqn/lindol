// Region settings shared across features.
export const REGION = {
  center: [7.08, 126.18],
  defaultUser: [7.085, 126.052],
  // Whole-Philippines query window for the feed/map.
  bbox: { minLat: 4.5, maxLat: 21.5, minLng: 116.0, maxLng: 127.0 },
  // The active Southern Mindanao aftershock zone we highlight on the map.
  highlight: { minLat: 4.8, maxLat: 7.2, minLng: 124.0, maxLng: 126.4 },
  minMagnitude: 2.0,
  alertMinMag: 4.5,
  // Only quakes within this many km of the user trigger an alert ("near you").
  alertRadiusKm: 300,
  // The anchor + snapshot guarantee the sequence survives; the live window just keeps recent
  // activity rich. ~30 days comfortably covers the active sequence.
  windowDays: 30,
};

// Hardest-hit areas, shown as clearly-labelled situation markers on the map (NOT citizen
// reports). Edit/remove these as the situation evolves - they reflect news coverage, not
// pinpoint verified incidents.
export const AFFECTED_AREAS = [
  { name: 'Glan, Sarangani', lat: 5.81, lng: 125.20,
    note: 'Among the hardest-hit: damaged roads, landslides and structures reported in news coverage.' },
  { name: 'General Santos City', lat: 6.11, lng: 125.17,
    note: 'Strong shaking and damage reported near the aftershock cluster.' },
];

// Sourced context about the current earthquake (shown as a collapsible card on Home). Edit
// these facts as the situation evolves; they're credited to the sources listed below.
export const EVENT_CONTEXT = {
  title: 'About this earthquake',
  facts: [
    { h: 'What happened', t: 'A shallow magnitude 7.8 reverse-fault earthquake ruptured under the sea off the southern coast of Mindanao on 8 June 2026, triggering a tsunami along nearby coasts.' },
    { h: 'Why here', t: 'It sits on the convergent boundary of the Sunda and Philippine Sea plates - part of the Pacific Ring of Fire, one of the most seismically active zones on Earth.' },
    { h: 'Expect aftershocks', t: '64 magnitude-7.0+ earthquakes have struck within 500 km of here since 1900 (most recently M7.3 on 10 October 2025). Strong aftershocks can continue for weeks - stay ready.' },
  ],
  sources: [
    { label: 'Hong Kong Observatory', url: 'https://my.weather.gov.hk/en/Observatorys-Blog/110612/M78-Major-Earthquake-off-the-southern-coast-of-Mindanao-the-Philippines-on-8-June-2026' },
    { label: 'USGS', url: 'https://earthquake.usgs.gov/' },
    { label: 'PHIVOLCS', url: 'https://www.phivolcs.dost.gov.ph/' },
  ],
};

// Emergency hotlines (national). Local barangay/DRRMO numbers vary, so we prompt users
// to save their own. Short codes (911/143) dial as-is; landlines include +63.
export const HOTLINES = [
  { label: 'National Emergency', number: '911', tel: '911', icon: '🚨' },
  { label: 'Philippine Red Cross', number: '143', tel: '143', icon: '➕' },
  { label: 'NDRRMC Operations', number: '(02) 8911-1406', tel: '+63289111406', icon: '🛟' },
  { label: 'PHIVOLCS (quake info)', number: '(02) 8929-9254', tel: '+63289299254', icon: '🌋' },
];

// Voluntary donation support. The Support card only renders once gcashNumber is set,
// so nothing placeholder/fake is ever shown publicly.
export const DONATION = {
  gcashName: '',
  gcashNumber: '0910 112 8075',
  gcashQr: '/gcash-qr.png',
};
