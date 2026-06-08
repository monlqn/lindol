import { describe, it, expect, beforeEach } from 'vitest';
import { getDeviceId } from './device.js';

beforeEach(() => localStorage.clear());

describe('getDeviceId', () => {
  it('returns a stable id across calls', () => {
    const a = getDeviceId();
    const b = getDeviceId();
    expect(a).toBe(b);
    expect(a).toMatch(/[0-9a-f-]{20,}/i);
  });
});
