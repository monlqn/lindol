import { describe, it, expect, beforeEach } from 'vitest';
import { checkReportRate, recordReport } from './rateLimit.js';

beforeEach(() => localStorage.clear());

describe('report rate limit (client throttle)', () => {
  it('allows when under the limit', () => {
    expect(checkReportRate(1000).ok).toBe(true);
  });
  it('blocks after 6 in the 5-min window, frees up after it passes', () => {
    const base = 1000;
    for (let i = 0; i < 6; i++) recordReport(base + i);
    const blocked = checkReportRate(base + 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.waitMin).toBeGreaterThan(0);
    expect(checkReportRate(base + 5 * 60000 + 1).ok).toBe(true);
  });
});
