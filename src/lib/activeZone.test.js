import { describe, it, expect } from 'vitest';
import { convexHull, activeZone, pointInPolygon } from './activeZone.js';

describe('convexHull', () => {
  it('returns the outer corners, dropping interior points', () => {
    const square = [[0, 0], [0, 1], [1, 0], [1, 1], [0.5, 0.5]];
    const hull = convexHull(square);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual([0.5, 0.5]);
  });
});

describe('activeZone', () => {
  const center = [5.8, 125.3];
  // a tight cluster around the centre...
  const cluster = Array.from({ length: 8 }, (_, i) => ({ lat: 5.8 + (i % 3) * 0.1, lng: 125.3 + (i % 4) * 0.1 }));

  it('builds a padded polygon from the cluster', () => {
    const zone = activeZone(cluster, center);
    expect(zone).not.toBeNull();
    expect(zone.length).toBeGreaterThanOrEqual(3);
    expect(zone.every(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))).toBe(true);
  });

  it('drops far outliers so they do not stretch the zone', () => {
    const outlier = { lat: 6.7, lng: 126.2 }; // ~150km NE (Davao Oriental-ish)
    const withOutlier = activeZone([...cluster, outlier], center, { maxKm: 130 });
    const maxLat = Math.max(...withOutlier.map((p) => p[0]));
    expect(maxLat).toBeLessThan(6.5); // outlier excluded
  });

  it('returns null when there are too few points', () => {
    expect(activeZone([{ lat: 5.8, lng: 125.3 }], center)).toBeNull();
  });
});

describe('pointInPolygon', () => {
  const sq = [[0, 0], [0, 2], [2, 2], [2, 0]]; // [lat,lng] square
  it('detects a point inside', () => {
    expect(pointInPolygon([1, 1], sq)).toBe(true);
  });
  it('detects a point outside', () => {
    expect(pointInPolygon([5, 5], sq)).toBe(false);
  });
  it('is safe with a null/empty polygon', () => {
    expect(pointInPolygon([1, 1], null)).toBe(false);
    expect(pointInPolygon([1, 1], [])).toBe(false);
  });
});
