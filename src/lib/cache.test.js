import { describe, it, expect, beforeEach } from 'vitest';
import { cacheGet, cacheSet } from './cache.js';

beforeEach(() => localStorage.clear());

describe('cache', () => {
  it('returns null for a missing key', () => {
    expect(cacheGet('nope')).toBeNull();
  });
  it('round-trips value + timestamp', () => {
    cacheSet('q', [{ id: 'a' }], 1000);
    const got = cacheGet('q');
    expect(got.value).toEqual([{ id: 'a' }]);
    expect(got.savedAt).toBe(1000);
  });
  it('returns null on corrupt data', () => {
    localStorage.setItem('lindol:bad', '{not json');
    expect(cacheGet('bad')).toBeNull();
  });
});
