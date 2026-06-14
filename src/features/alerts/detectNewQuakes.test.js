import { describe, it, expect } from 'vitest';
import { detectNewAlerts } from './detectNewQuakes.js';
const q = (id, mag, time, lat = 7, lng = 126) => ({ id, mag, time, place: 'x', lat, lng });

describe('detectNewAlerts', () => {
  it('alerts for a recent above-threshold quake even on the first run', () => {
    const seen = new Set();
    expect(detectNewAlerts([q('a', 5, 2000)], seen, 4.5, 1000).map((x) => x.id)).toEqual(['a']);
  });

  it('does not re-alert a quake already seen', () => {
    const seen = new Set();
    detectNewAlerts([q('a', 5, 2000)], seen, 4.5, 1000);
    expect(detectNewAlerts([q('a', 5, 2000)], seen, 4.5, 1000)).toEqual([]);
  });

  it('ignores new quakes below threshold', () => {
    const seen = new Set();
    expect(detectNewAlerts([q('c', 3.9, 3000)], seen, 4.5, 1000)).toEqual([]);
    expect(seen.has('c')).toBe(true);
  });

  it('ignores quakes older than sinceMs', () => {
    const seen = new Set();
    expect(detectNewAlerts([q('d', 6, 500)], seen, 4.5, 1000)).toEqual([]);
  });

  it('does not alert the same quake re-reported by another source twice', () => {
    const seen = new Set();
    // same minute + ~same location, different source id -> second is a duplicate.
    expect(detectNewAlerts([q('usgs1', 5, 120000, 7.0, 126.0)], seen, 4.5, 1000).map((x) => x.id)).toEqual(['usgs1']);
    expect(detectNewAlerts([q('phiv1', 5, 120000, 7.03, 126.04)], seen, 4.5, 1000)).toEqual([]);
  });
});
