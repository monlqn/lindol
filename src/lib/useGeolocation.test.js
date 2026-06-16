import { describe, it, expect } from 'vitest';
import { isLocated } from './useGeolocation.js';
import { REGION } from '../config.js';

describe('isLocated', () => {
  it('is false for the regional default (no real fix yet)', () => {
    expect(isLocated(REGION.defaultUser)).toBe(false);
    expect(isLocated([...REGION.defaultUser])).toBe(false);
  });

  it('is true for a real coordinate that differs from the default', () => {
    expect(isLocated([14.6, 121.0])).toBe(true); // Manila
  });

  it('is false for missing/invalid input', () => {
    expect(isLocated(null)).toBe(false);
    expect(isLocated(undefined)).toBe(false);
  });
});
