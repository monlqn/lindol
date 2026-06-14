import { describe, it, expect } from 'vitest';
import { classifyQuakes } from './sequences.js';

// A tiny test sequence: mainshock at (6,125), aftershock radius 150 km, start at t=1000.
const SEQ = {
  id: 'test-seq',
  mainshock: { id: 'main', time: 1000, lat: 6, lng: 125, mag: 7.8 },
  center: [6, 125],
  radiusKm: 150,
  startTime: 1000,
};

describe('classifyQuakes', () => {
  it('picks the mainshock by anchor, not by largest magnitude in the feed', () => {
    const feed = [
      { id: 'main', time: 1000, lat: 6, lng: 125, mag: 7.8 },
      { id: 'huge-elsewhere', time: 2000, lat: 18, lng: 121, mag: 8.5 }, // bigger, far north
    ];
    const { mainshock, other } = classifyQuakes(feed, SEQ);
    expect(mainshock.id).toBe('main');
    expect(other.map((q) => q.id)).toContain('huge-elsewhere');
  });

  it('puts a far-away quake (Luzon) in other, never aftershocks', () => {
    const feed = [
      { id: 'main', time: 1000, lat: 6, lng: 125, mag: 7.8 },
      { id: 'luzon', time: 3000, lat: 16.5, lng: 120.5, mag: 5.0 },
    ];
    const { aftershocks, other } = classifyQuakes(feed, SEQ);
    expect(aftershocks.map((q) => q.id)).not.toContain('luzon');
    expect(other.map((q) => q.id)).toContain('luzon');
  });

  it('puts a nearby post-mainshock quake in aftershocks', () => {
    const feed = [
      { id: 'main', time: 1000, lat: 6, lng: 125, mag: 7.8 },
      { id: 'near-after', time: 5000, lat: 6.3, lng: 125.2, mag: 4.5 },
    ];
    const { aftershocks } = classifyQuakes(feed, SEQ);
    expect(aftershocks.map((q) => q.id)).toContain('near-after');
  });

  it('puts a nearby PRE-mainshock quake in other, not aftershocks', () => {
    const feed = [
      { id: 'main', time: 1000, lat: 6, lng: 125, mag: 7.8 },
      { id: 'near-before', time: 500, lat: 6.1, lng: 125.1, mag: 4.0 },
    ];
    const { aftershocks, other } = classifyQuakes(feed, SEQ);
    expect(aftershocks.map((q) => q.id)).not.toContain('near-before');
    expect(other.map((q) => q.id)).toContain('near-before');
  });

  it('falls back to the static anchor when the feed lacks the mainshock', () => {
    const feed = [{ id: 'luzon', time: 3000, lat: 16.5, lng: 120.5, mag: 5.0 }];
    const { mainshock, aftershocks } = classifyQuakes(feed, SEQ);
    expect(mainshock.id).toBe('main');
    expect(aftershocks).toEqual([]);
  });

  it('handles an empty feed', () => {
    const { mainshock, aftershocks, other } = classifyQuakes([], SEQ);
    expect(mainshock.id).toBe('main');
    expect(aftershocks).toEqual([]);
    expect(other).toEqual([]);
  });
});
