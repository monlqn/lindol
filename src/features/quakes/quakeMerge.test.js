import { describe, it, expect } from 'vitest';
import { sameQuake, mergeQuakes, mergeFreshest } from './quakeMerge.js';

const base = { id: 'us1', mag: 5.0, time: 1_000_000, lat: 7.0, lng: 126.0 };

describe('sameQuake', () => {
  it('matches the same event reported by two sources', () => {
    const emsc = { id: 'emsc:1', mag: 5.1, time: 1_000_000 + 20_000, lat: 7.05, lng: 126.03 };
    expect(sameQuake(base, emsc)).toBe(true);
  });

  it('rejects events far apart in time or distance', () => {
    expect(sameQuake(base, { ...base, id: 'e', time: 1_000_000 + 200_000 })).toBe(false);
    expect(sameQuake(base, { ...base, id: 'e', lat: 9.0, lng: 124.0 })).toBe(false);
  });
});

describe('mergeQuakes', () => {
  it('appends only EMSC events that USGS does not already have', () => {
    const usgs = [base];
    const emsc = [
      { id: 'emsc:dup', mag: 5.05, time: 1_000_000 + 10_000, lat: 7.01, lng: 126.01 }, // duplicate
      { id: 'emsc:new', mag: 4.6, time: 2_000_000, lat: 6.0, lng: 125.0 },              // new event
    ];
    const merged = mergeQuakes(usgs, emsc);
    expect(merged).toHaveLength(2);
    expect(merged.map((q) => q.id)).toContain('emsc:new');
    expect(merged.map((q) => q.id)).not.toContain('emsc:dup');
  });

  it('a micro extra cannot displace a real M2.0+ primary event it collides with', () => {
    // Regression: micro must be merged as `extra`, never as primary, or sameQuake lets a tiny
    // PHIVOLCS micro absorb a genuine USGS/EMSC event in the same swarm.
    const real = [{ id: 'usgs:1', mag: 2.6, time: 1000, lat: 5, lng: 125 }];
    const micro = [{ id: 'phivolcs:x', mag: 1.5, time: 1050, lat: 5.0, lng: 125.0 }]; // within 90s/80km/1.2mag
    const merged = mergeQuakes(real, micro);
    expect(merged).toHaveLength(1);
    expect(merged[0].mag).toBe(2.6); // real event kept; micro absorbed, not the other way around
  });

  it('dedups a micro-feed row that repeats a main-feed quake by id, keeping micro-only rows', () => {
    const main = [{ id: 'phivolcs:1:5:125', mag: 2.6, time: 1, lat: 5, lng: 125 }];
    const micro = [
      { id: 'phivolcs:1:5:125', mag: 2.6, time: 1, lat: 5, lng: 125 },  // exact dup of main (overlap band)
      { id: 'phivolcs:2:6:126', mag: 1.4, time: 2, lat: 6, lng: 126 },  // micro-only, far away -> survives
    ];
    const merged = mergeQuakes(main, micro);
    expect(merged).toHaveLength(2);
    expect(merged.map((q) => q.mag).sort()).toEqual([1.4, 2.6]);
  });

  it('consolidates the reporting sources without changing the kept value', () => {
    const phiv = [{ ...base, id: 'ph1', mag: 4.8, source: 'phivolcs' }];
    const usgs = [{ ...base, id: 'us1', mag: 5.0 }];                          // dup, USGS
    const emsc = [{ ...base, id: 'emsc:1', mag: 5.1, source: 'emsc' }];       // dup, EMSC
    const merged = mergeQuakes(mergeQuakes(phiv, usgs), emsc);
    expect(merged).toHaveLength(1);
    expect(merged[0].mag).toBe(4.8);                  // PHIVOLCS value kept
    expect(merged[0].sources.sort()).toEqual(['EMSC', 'PHIVOLCS', 'USGS']);
  });
});

describe('mergeFreshest', () => {
  const prelim = { id: 'emsc:1', mag: 4.2, time: 1000, lat: 7, lng: 126, updatedAt: 1000 };
  const revised = { id: 'emsc:1', mag: 6.2, time: 1000, lat: 7, lng: 126, updatedAt: 9000 };

  it('keeps the most recently updated record for the same event id', () => {
    const out = mergeFreshest([prelim], [revised]);
    expect(out).toHaveLength(1);
    expect(out[0].mag).toBe(6.2);
  });

  it('keeps the revised record regardless of which list it arrives in', () => {
    expect(mergeFreshest([revised], [prelim])[0].mag).toBe(6.2);
  });

  it('unions distinct events', () => {
    const other = { id: 'emsc:2', mag: 5, time: 2000, lat: 6, lng: 125, updatedAt: 2000 };
    expect(mergeFreshest([prelim], [other])).toHaveLength(2);
  });

  it('falls back to time when updatedAt is absent', () => {
    const a = { id: 'emsc:3', mag: 4.0, time: 1000, lat: 7, lng: 126 };
    const b = { id: 'emsc:3', mag: 5.5, time: 2000, lat: 7, lng: 126 };
    expect(mergeFreshest([a], [b])[0].mag).toBe(5.5);
  });
});
