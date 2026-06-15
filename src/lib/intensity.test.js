import { describe, it, expect } from 'vitest';
import { nearestTownIntensity, modeledIntensityAtUser } from './intensity.js';

const user = [7.07, 125.61]; // Davao City
const ev = (mag, time, reports) => ({ mag, time, reports });
const town = (place, lat, lng, mmi) => ({ place, lat, lng, mmi });
// A single MMI contour as a closed square in [lng,lat] points (matches intensityAt's ray-cast).
const square = (value, [s, w, n, e]) => ({ value, lines: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });

describe('nearestTownIntensity', () => {
  const now = 1_000_000_000_000;

  it('prefers the most recent felt event over a stronger but older one', () => {
    const older = ev(7.8, now - 40 * 3600000, [town('Davao City', 7.07, 125.60, 5)]); // 40h ago
    const recent = ev(6.2, now - 3600000, [town('Davao City', 7.07, 125.60, 3)]);      // 1h ago
    const r = nearestTownIntensity(user, [older, recent], { now });
    expect(r.mag).toBe(6.2);
    expect(r.mmi).toBe(3);
  });

  it('returns null when no felt event is within the recency window', () => {
    const old = ev(7.8, now - 10 * 86400000, [town('Davao City', 7.07, 125.60, 5)]); // 10 days ago
    expect(nearestTownIntensity(user, [old], { now })).toBe(null);
  });

  it('ignores events whose nearest report is beyond maxKm', () => {
    const far = ev(6.0, now - 3600000, [town('Manila', 14.6, 121.0, 5)]);
    expect(nearestTownIntensity(user, [far], { now })).toBe(null);
  });

  it('picks the nearest reporting town within the chosen event', () => {
    const e = ev(6.2, now - 3600000, [town('Far', 7.5, 125.9, 4), town('Near', 7.07, 125.61, 3)]);
    expect(nearestTownIntensity(user, [e], { now }).place).toBe('Near');
  });
});

describe('modeledIntensityAtUser', () => {
  const now = 1_000_000_000_000;
  const cover = [square(5, [6.5, 125.0, 7.5, 126.0])]; // contour containing the Davao user

  it('returns null for a stale shakemap (older than the window, e.g. the week-old mainshock)', () => {
    const sm = { event: { mag: 7.8, time: now - 8 * 86400000 }, contours: cover };
    expect(modeledIntensityAtUser(user, sm, { now })).toBe(null);
  });

  it('returns the modeled MMI for a recent shakemap that covers the user', () => {
    const sm = { event: { mag: 6.2, time: now - 3600000 }, contours: cover };
    expect(modeledIntensityAtUser(user, sm, { now })).toEqual({ mmi: 5, mag: 6.2 });
  });

  it('returns null when the user is outside every contour', () => {
    const sm = { event: { mag: 6.2, time: now - 3600000 }, contours: [square(5, [0, 120.0, 1, 121.0])] };
    expect(modeledIntensityAtUser(user, sm, { now })).toBe(null);
  });

  it('returns null when there is no shakemap', () => {
    expect(modeledIntensityAtUser(user, null, { now })).toBe(null);
    expect(modeledIntensityAtUser(user, { event: null, contours: [] }, { now })).toBe(null);
  });
});
