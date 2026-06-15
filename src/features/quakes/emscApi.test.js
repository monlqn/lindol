import { describe, it, expect } from 'vitest';
import { buildEmscUrl, parseEmscQuakes, parseEmscWsEvent } from './emscApi.js';
import { REGION } from '../../config.js';

describe('buildEmscUrl', () => {
  it('targets EMSC with the region bbox and magnitude', () => {
    const url = buildEmscUrl(REGION);
    expect(url).toContain('seismicportal.eu');
    expect(url).toContain('format=json');
    expect(url).toContain('minmagnitude=2');
    expect(url).toContain('minlatitude=4.5');
  });
});

describe('parseEmscQuakes', () => {
  it('normalizes an EMSC feature into the shared quake shape', () => {
    const geo = {
      features: [{
        id: 'x',
        properties: { unid: '20240801_0000001', mag: 5.2, flynn_region: 'MINDANAO, PHILIPPINES', time: '2024-08-01T12:00:00.0Z', depth: 12 },
        geometry: { coordinates: [126.1, 7.0, 12] },
      }],
    };
    const [q] = parseEmscQuakes(geo);
    expect(q.id).toBe('emsc:20240801_0000001');
    expect(q.mag).toBe(5.2);
    expect(q.lat).toBe(7.0);
    expect(q.lng).toBe(126.1);
    expect(typeof q.time).toBe('number');
    expect(q.place).toContain('MINDANAO');
  });

  it('drops features without a numeric magnitude or coordinates', () => {
    expect(parseEmscQuakes(null)).toEqual([]);
    expect(parseEmscQuakes({ features: [{ properties: {} }] })).toEqual([]);
  });

  it('captures lastupdate as updatedAt so a revised report can supersede a stale one', () => {
    const geo = {
      features: [{
        id: 'x',
        properties: { unid: 'u1', mag: 5.2, time: '2024-08-01T12:00:00.0Z', lastupdate: '2024-08-01T12:08:00.0Z' },
        geometry: { coordinates: [126.1, 7.0, 12] },
      }],
    };
    const [q] = parseEmscQuakes(geo);
    expect(q.updatedAt).toBe(Date.parse('2024-08-01T12:08:00.0Z'));
  });
});

describe('parseEmscWsEvent', () => {
  it('carries updatedAt from lastupdate so a revised push wins on merge', () => {
    const msg = {
      action: 'update',
      data: {
        id: 'd',
        properties: { unid: 'u1', mag: 6.2, time: '2024-08-01T12:01:00Z', lastupdate: '2024-08-01T12:09:00Z', lat: 7, lon: 126 },
        geometry: { coordinates: [126, 7, 10] },
      },
    };
    expect(parseEmscWsEvent(msg).updatedAt).toBe(Date.parse('2024-08-01T12:09:00Z'));
  });
});
