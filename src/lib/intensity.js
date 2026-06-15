import { haversineKm } from './geo.js';

// Work out the shaking intensity (MMI) a user experienced, from the USGS ShakeMap contour bands
// (which we already fetch for the map). The user's intensity = the highest contour value whose
// region contains them - the bands are concentric (intensity drops outward), so this is the
// modelled intensity at their exact location, not just the epicentre's max.

// Even-odd ray cast: is [lat,lng] inside the region bounded by these line loops? `lines` is an
// array of lines, each an array of [lng, lat] points (a contour's MultiLineString).
function inside(lat, lng, lines) {
  let c = false;
  for (const line of lines) {
    for (let i = 0, j = line.length - 1; i < line.length; j = i++) {
      const xi = line[i][0]; const yi = line[i][1];
      const xj = line[j][0]; const yj = line[j][1];
      if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) c = !c;
    }
  }
  return c;
}

export function intensityAt(user, contours) {
  if (!Array.isArray(user) || !Array.isArray(contours) || !contours.length) return 0;
  const [lat, lng] = user;
  let mmi = 0;
  for (const ct of contours) {
    if (Array.isArray(ct.lines) && inside(lat, lng, ct.lines)) mmi = Math.max(mmi, ct.value);
  }
  return mmi;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export function mmiRoman(m) { return ROMAN[Math.min(10, Math.max(1, Math.round(m)))]; }

export function mmiLabel(m) {
  if (m < 2) return 'Not felt';
  if (m < 4) return 'Weak';
  if (m < 5) return 'Light';
  if (m < 6) return 'Moderate';
  if (m < 7) return 'Strong';
  if (m < 8) return 'Very strong';
  if (m < 9) return 'Severe';
  return 'Violent';
}

// ShakeMap intensity palette.
export function mmiColor(m) {
  return m >= 8 ? '#ff9100' : m >= 7 ? '#ffc600' : m >= 6 ? '#ffff00'
    : m >= 5 ? '#bbff4a' : m >= 4 ? '#7cffc7' : m >= 3 ? '#80ffff' : '#90f2ff';
}

// The PHIVOLCS-reported intensity at the town nearest the user, for the MOST RECENT event that
// actually shook their area (a felt report within maxKm), within maxAgeMs. We prefer recency over
// magnitude so today's nearby quake is shown rather than the week-old mainshock; if nothing recent
// reached the user the card hides (honest "no significant shaking near you lately").
// Returns { mmi, place, distanceKm, mag, time } or null.
export function nearestTownIntensity(user, events, { maxKm = 90, maxAgeMs = 72 * 3600000, now = Date.now() } = {}) {
  if (!Array.isArray(user) || !Array.isArray(events)) return null;
  const candidates = [];
  for (const e of events) {
    if (!e || !Array.isArray(e.reports) || !e.reports.length) continue;
    if (Number.isFinite(e.time) && e.time < now - maxAgeMs) continue; // too old to count as "now"
    let nearest = null;
    for (const r of e.reports) {
      const d = haversineKm(user, [r.lat, r.lng]);
      if (d <= maxKm && (!nearest || d < nearest.distanceKm)) {
        nearest = { mmi: r.mmi, place: r.place, distanceKm: d, mag: e.mag, time: e.time };
      }
    }
    if (nearest) candidates.push(nearest);
  }
  if (!candidates.length) return null;
  // Most recent felt event wins; fall back to the stronger one when times are equal/missing.
  return candidates.reduce((a, b) => {
    const at = Number.isFinite(a.time) ? a.time : -Infinity;
    const bt = Number.isFinite(b.time) ? b.time : -Infinity;
    if (bt !== at) return bt > at ? b : a;
    return b.mag > a.mag ? b : a;
  });
}
