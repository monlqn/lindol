import { describe, it, expect } from 'vitest';
import { buildUsgsUrl, parseQuakes } from './quakeApi.js';
import { REGION } from '../../config.js';

describe('buildUsgsUrl', () => {
  it('includes bbox, min magnitude, and geojson format', () => {
    const url = buildUsgsUrl(REGION);
    expect(url).toContain('format=geojson');
    expect(url).toContain('minlatitude=4.5');
    expect(url).toContain('maxlongitude=127');
    expect(url).toContain('minmagnitude=2');
  });
});

describe('parseQuakes', () => {
  const geojson = {
    features: [
      { id: 'a', properties: { mag: 6.9, place: '23 km E of Davao Oriental', time: 1000 },
        geometry: { coordinates: [126.3, 7.05, 31] } },
      { id: 'b', properties: { mag: 4.3, place: 'near coast', time: 2000 },
        geometry: { coordinates: [126.34, 7.1, 10] } },
    ],
  };
  it('normalizes features into Quake objects', () => {
    const out = parseQuakes(geojson);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: 'a', mag: 6.9, depthKm: 31, lat: 7.05, lng: 126.3 });
  });
  it('drops features with no magnitude', () => {
    const out = parseQuakes({ features: [{ id: 'x', properties: { mag: null, time: 1 }, geometry: { coordinates: [1, 2, 3] } }] });
    expect(out).toHaveLength(0);
  });
  it('returns [] for empty/invalid input', () => {
    expect(parseQuakes(null)).toEqual([]);
    expect(parseQuakes({})).toEqual([]);
  });
  it('drops features with non-finite coordinates or time (no NaN into the feed)', () => {
    const out = parseQuakes({ features: [
      { id: 'noGeom', properties: { mag: 5, place: 'x', time: 1 } }, // missing geometry -> lat/lng undefined
      { id: 'noTime', properties: { mag: 5, place: 'x', time: null }, geometry: { coordinates: [126, 7, 5] } },
    ] });
    expect(out).toHaveLength(0);
  });
});
