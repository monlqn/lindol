import { describe, it, expect } from 'vitest';
import { rejectFile } from './image.js';

describe('rejectFile', () => {
  it('accepts a normal-sized image', () => {
    expect(rejectFile({ type: 'image/jpeg', size: 2_000_000 })).toBeNull();
  });
  it('rejects non-images', () => {
    expect(rejectFile({ type: 'application/pdf', size: 1000 })).toMatch(/image/i);
  });
  it('rejects oversized files (>20MB pre-compression)', () => {
    expect(rejectFile({ type: 'image/jpeg', size: 25_000_000 })).toMatch(/too large/i);
  });
});
