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

  it('ignores new quakes below threshold and does NOT mark them seen (so an upgrade can alert)', () => {
    const seen = new Set();
    expect(detectNewAlerts([q('c', 3.9, 3000)], seen, 4.5, 1000)).toEqual([]);
    expect(seen.has('c')).toBe(false);
  });

  it('alerts when a preliminary sub-threshold quake is later revised above threshold', () => {
    const seen = new Set();
    // EMSC often pushes a low preliminary magnitude first, then revises it upward minutes later.
    expect(detectNewAlerts([q('e', 4.0, 5000)], seen, 4.5, 1000)).toEqual([]);
    expect(detectNewAlerts([q('e', 6.2, 5000)], seen, 4.5, 1000).map((x) => x.id)).toEqual(['e']);
  });

  it('does not re-alert the same physical quake after the feed swaps its source id', () => {
    const seen = new Set();
    const alerted = [];
    const emsc = q('emsc:1', 6.0, 1_000_000, 6.50, 125.20);
    const first = detectNewAlerts([emsc], seen, 4.5, 1000, alerted);
    expect(first.map((x) => x.id)).toEqual(['emsc:1']);
    alerted.push(...first);
    // PHIVOLCS publishes the same event seconds later: different id, shifted epicentre, and a clock
    // tick that crosses the coarse-signature minute bucket - so only sameQuake matching can catch it.
    const phiv = q('phivolcs:9', 6.2, 1_080_000, 6.55, 125.25);
    expect(detectNewAlerts([phiv], seen, 4.5, 1000, alerted)).toEqual([]);
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
