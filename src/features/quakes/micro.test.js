import { describe, it, expect } from 'vitest';
import { isMicro, splitMicro } from './micro.js';

const region = { minMagnitude: 2.0 };

describe('isMicro', () => {
  it('is true below the feed minimum, false at or above it (M2.0 is not micro)', () => {
    expect(isMicro({ mag: 1.4 }, region)).toBe(true);
    expect(isMicro({ mag: 1.9 }, region)).toBe(true);
    expect(isMicro({ mag: 2.0 }, region)).toBe(false);
    expect(isMicro({ mag: 3.1 }, region)).toBe(false);
  });
});

describe('splitMicro', () => {
  it('counts micro vs main against the boundary', () => {
    const qs = [{ mag: 1.3 }, { mag: 1.9 }, { mag: 2.0 }, { mag: 5.5 }];
    expect(splitMicro(qs, region)).toEqual({ microCount: 2, mainCount: 2 });
  });

  it('is safe on empty input', () => {
    expect(splitMicro([], region)).toEqual({ microCount: 0, mainCount: 0 });
  });
});
