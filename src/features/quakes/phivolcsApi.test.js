import { describe, it, expect } from 'vitest';
import { parseBulletin } from '../../../api/phivolcs.js';
import { buildPhivolcsUrl, buildPhivolcsMicroUrl, parsePhivolcsQuakes } from './phivolcsApi.js';

const SAMPLE = `
<table>
  <tr><th>Date - Time</th><th>Latitude</th><th>Longitude</th><th>Depth</th><th>Mag</th><th>Location</th></tr>
  <tr>
    <td><a href="x.html">09 June 2026 - 04:21 PM</a></td>
    <td>05.51</td><td>125.08</td><td>003</td><td>3.1</td>
    <td>037 km S 22&deg; W of Glan (Sarangani)</td>
  </tr>
  <tr>
    <td>09 June 2026 - 04:05 AM</td>
    <td>05.53</td><td>125.23</td><td>033</td><td>1.4</td>
    <td>025 km N 59&deg; W of Balut Island</td>
  </tr>
  <tr><td>garbage row</td></tr>
</table>`;

describe('parseBulletin', () => {
  const quakes = parseBulletin(SAMPLE);

  it('extracts only valid quake rows', () => {
    expect(quakes).toHaveLength(2);
  });

  it('normalizes to the shared Quake shape with source=phivolcs', () => {
    const q = quakes[0];
    expect(q.mag).toBe(3.1);
    expect(q.lat).toBeCloseTo(5.51);
    expect(q.lng).toBeCloseTo(125.08);
    expect(q.depthKm).toBe(3);
    expect(q.source).toBe('phivolcs');
    expect(q.place).toContain('Glan');
    expect(q.id).toContain('phivolcs:');
  });

  it('reads the PHT timestamp as UTC+8', () => {
    expect(quakes[0].time).toBe(Date.parse('2026-06-09T16:21:00+08:00'));
    expect(quakes[1].time).toBe(Date.parse('2026-06-09T04:05:00+08:00'));
  });
});

describe('buildPhivolcsUrl', () => {
  it('passes the region window + magnitude floor', () => {
    const url = buildPhivolcsUrl({ windowDays: 7, minMagnitude: 2 });
    expect(url).toBe('/api/phivolcs?days=7&min=2');
  });
});

describe('buildPhivolcsMicroUrl', () => {
  it('fetches a short window down to the micro floor, separate from the main feed', () => {
    expect(buildPhivolcsMicroUrl({ microWindowDays: 3, microMinMag: 1 })).toBe('/api/phivolcs?days=3&min=1');
  });
});

describe('parsePhivolcsQuakes', () => {
  it('returns the quakes array and drops malformed entries', () => {
    const json = { quakes: [
      { lat: 5.5, lng: 125, time: 1, mag: 3 },
      { lat: 'x', lng: 125, time: 1, mag: 3 },
    ] };
    expect(parsePhivolcsQuakes(json)).toHaveLength(1);
  });

  it('is safe on empty/garbage input', () => {
    expect(parsePhivolcsQuakes(null)).toEqual([]);
    expect(parsePhivolcsQuakes({})).toEqual([]);
  });
});
