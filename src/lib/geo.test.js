import { describe, it, expect } from 'vitest';
import { haversineKm, formatKm } from './geo.js';

describe('haversineKm', () => {
  it('is ~0 for identical points', () => {
    expect(haversineKm([7, 126], [7, 126])).toBeCloseTo(0, 5);
  });
  it('matches a known distance (Davao ~ epicenter)', () => {
    const d = haversineKm([7.085, 126.052], [7.05, 126.30]);
    expect(d).toBeGreaterThan(24);
    expect(d).toBeLessThan(32);
  });
});

describe('formatKm', () => {
  it('rounds whole km with unit', () => {
    expect(formatKm(38.4)).toBe('38 km');
  });
  it('shows one decimal under 10 km', () => {
    expect(formatKm(0.42)).toBe('0.4 km');
  });
});
