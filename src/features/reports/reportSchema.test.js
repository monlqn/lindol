import { describe, it, expect } from 'vitest';
import { CATEGORIES, categoryColor, validateReport } from './reportSchema.js';

describe('CATEGORIES', () => {
  it('has the six categories with keys + colors', () => {
    expect(CATEGORIES.map((c) => c.key)).toEqual(['damage','road','fire','help','safe','other']);
    expect(categoryColor('fire')).toBe('#E0521B');
    expect(categoryColor('nope')).toBe('#8A8175');
  });
});

describe('validateReport', () => {
  const base = { category: 'damage', note: '', lat: 7.0, lng: 126.0 };
  it('accepts a valid report', () => {
    expect(validateReport(base)).toEqual({ valid: true, errors: [] });
  });
  it('rejects an unknown category', () => {
    expect(validateReport({ ...base, category: 'x' }).valid).toBe(false);
  });
  it('rejects missing coordinates', () => {
    expect(validateReport({ ...base, lat: null }).valid).toBe(false);
  });
  it('rejects an over-long note', () => {
    expect(validateReport({ ...base, note: 'x'.repeat(281) }).valid).toBe(false);
  });
});
