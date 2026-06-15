import { describe, it, expect } from 'vitest';
import { latestMajor } from './latestMajor.js';

const q = (id, mag, time, lat = 6, lng = 125) => ({ id, mag, time, lat, lng });

describe('latestMajor', () => {
  it('returns the most recent quake at or above the threshold', () => {
    const quakes = [
      q('main', 7.8, 1000),
      q('today', 6.2, 5000), // most recent at/above 6.0
      q('small', 4.5, 9000), // newer but below threshold
    ];
    expect(latestMajor(quakes, 6.0).id).toBe('today');
  });

  it('returns null when nothing meets the threshold', () => {
    expect(latestMajor([q('a', 5.9, 1000), q('b', 5.0, 2000)], 6.0)).toBe(null);
  });

  it('falls back to the only major event when nothing newer qualifies', () => {
    expect(latestMajor([q('main', 7.8, 1000), q('after', 5.2, 8000)], 6.0).id).toBe('main');
  });

  it('returns null for an empty feed', () => {
    expect(latestMajor([], 6.0)).toBe(null);
  });
});
