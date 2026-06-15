import { describe, it, expect } from 'vitest';
import { magFloorForZoom } from './mapDetail.js';

describe('magFloorForZoom', () => {
  it('hides small quakes at the country/region view', () => {
    expect(magFloorForZoom(6)).toBeGreaterThanOrEqual(4.0);
  });

  it('lowers the floor as you zoom in', () => {
    expect(magFloorForZoom(8)).toBeLessThan(magFloorForZoom(6));
    expect(magFloorForZoom(10)).toBeLessThan(magFloorForZoom(8));
  });

  it('shows everything (floor at/below the 2.0 feed minimum) once zoomed in close', () => {
    expect(magFloorForZoom(11)).toBeLessThanOrEqual(2.0);
    expect(magFloorForZoom(14)).toBeLessThanOrEqual(2.0);
  });

  it('never returns a negative floor', () => {
    expect(magFloorForZoom(20)).toBeGreaterThanOrEqual(0);
  });
});
