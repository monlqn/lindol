import { describe, it, expect } from 'vitest';
import { sameQuake, mergeQuakes } from './quakeMerge.js';

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
});
