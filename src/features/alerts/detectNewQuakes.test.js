import { describe, it, expect } from 'vitest';
import { detectNewAlerts } from './detectNewQuakes.js';
const q = (id, mag, time) => ({ id, mag, time, place: 'x', lat: 7, lng: 126 });
describe('detectNewAlerts', () => {
  it('returns nothing for the initial baseline (seen empty)', () => {
    const seen = new Set();
    expect(detectNewAlerts([q('a', 5, 2000)], seen, 4.5, 1000)).toEqual([]);
    expect(seen.has('a')).toBe(true);
  });
  it('flags a new quake above threshold after baseline', () => {
    const seen = new Set(['a']);
    expect(detectNewAlerts([q('a', 5, 2000), q('b', 4.8, 3000)], seen, 4.5, 1000).map((x) => x.id)).toEqual(['b']);
  });
  it('ignores new quakes below threshold', () => {
    const seen = new Set(['a']);
    expect(detectNewAlerts([q('a', 5, 2000), q('c', 3.9, 3000)], seen, 4.5, 1000)).toEqual([]);
    expect(seen.has('c')).toBe(true);
  });
  it('ignores quakes older than sinceMs', () => {
    const seen = new Set(['a']);
    expect(detectNewAlerts([q('a', 5, 2000), q('d', 6, 500)], seen, 4.5, 1000)).toEqual([]);
  });
});
