import { describe, it, expect } from 'vitest';
import { nearestTownIntensity } from './intensity.js';

const user = [7.07, 125.61]; // Davao City
const ev = (mag, time, reports) => ({ mag, time, reports });
const town = (place, lat, lng, mmi) => ({ place, lat, lng, mmi });

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
