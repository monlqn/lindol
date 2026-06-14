import { haversineKm } from '../../lib/geo.js';
import { sameQuake } from './quakeMerge.js';

// The M7.8 Sarangani / Southern Mindanao sequence, pinned so the app's headline event can
// never drop off the rolling window or be silently replaced by a later larger quake. Values
// are the authoritative mainshock record captured in the week-1 snapshot (Task 1).
export const SARANGANI_SEQUENCE = {
  id: 'sarangani-2026-06',
  name: 'Sarangani / Southern Mindanao sequence',
  mainshock: {
    id: 'phivolcs:1780875420000:5.57:124.98',
    time: 1780875420000,
    lat: 5.57,
    lng: 124.98,
    mag: 7.8,
    depthKm: 33,
    place: '032 km S 04° W of Maasim (Sarangani)',
    source: 'phivolcs',
    sources: ['PHIVOLCS', 'USGS', 'EMSC'],
  },
  // A quake within radiusKm of the epicentre AND at/after the mainshock is a sequence aftershock.
  center: [5.57, 124.98],
  radiusKm: 150,
  startTime: 1780875420000,
};

// Split a merged quake feed into the pinned mainshock, its genuine aftershocks (near in space,
// at/after the mainshock in time), and every other quake in the country. Pure and total.
export function classifyQuakes(quakes = [], sequence = SARANGANI_SEQUENCE) {
  const list = Array.isArray(quakes) ? quakes : [];
  const anchor = sequence.mainshock;
  let mainshock = null;
  const rest = [];
  for (const q of list) {
    if (!mainshock && (q.id === anchor.id || sameQuake(q, anchor))) mainshock = q;
    else rest.push(q);
  }
  if (!mainshock) mainshock = anchor;

  const aftershocks = [];
  const other = [];
  for (const q of rest) {
    const near = Number.isFinite(q.lat) && Number.isFinite(q.lng)
      && haversineKm(sequence.center, [q.lat, q.lng]) <= sequence.radiusKm;
    if (near && q.time >= sequence.startTime) aftershocks.push(q);
    else other.push(q);
  }
  return { mainshock, aftershocks, other };
}
