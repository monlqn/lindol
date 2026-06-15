import { describe, it, expect } from 'vitest';
import { pickShakemapEvent } from './shakemap.js';

const f = (types) => ({ properties: { types } });

describe('pickShakemapEvent', () => {
  it('prefers the most recent event that actually has a ShakeMap', () => {
    const feats = [f(',origin,'), f(',origin,shakemap,'), f(',shakemap,')]; // newest-first
    expect(pickShakemapEvent(feats)).toBe(feats[1]);
  });

  it('falls back to the most recent event when none has a ShakeMap', () => {
    const feats = [f(',origin,'), f(',origin,')];
    expect(pickShakemapEvent(feats)).toBe(feats[0]);
  });

  it('only considers the 6 newest candidates', () => {
    const feats = Array.from({ length: 10 }, () => f(',origin,'));
    feats[7] = f(',shakemap,'); // beyond the first 6 -> ignored
    expect(pickShakemapEvent(feats)).toBe(feats[0]);
  });

  it('returns null for no events', () => {
    expect(pickShakemapEvent([])).toBe(null);
    expect(pickShakemapEvent()).toBe(null);
  });
});
