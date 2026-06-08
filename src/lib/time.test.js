import { describe, it, expect } from 'vitest';
import { relativeTime, formatClock } from './time.js';

const NOW = new Date('2026-06-08T09:51:00+08:00').getTime();

describe('relativeTime', () => {
  it('shows minutes', () => {
    expect(relativeTime(NOW - 6 * 60000, NOW)).toBe('6 min ago');
  });
  it('shows hours', () => {
    expect(relativeTime(NOW - 2 * 3600000, NOW)).toBe('2h ago');
  });
  it('shows "now" under a minute', () => {
    expect(relativeTime(NOW - 5000, NOW)).toBe('now');
  });
});

describe('formatClock', () => {
  it('formats 24h clock in Asia/Manila', () => {
    expect(formatClock(NOW)).toBe('09:51');
  });
});
