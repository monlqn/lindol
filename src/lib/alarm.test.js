import { describe, it, expect, vi } from 'vitest';
import { isArmed, arm } from './alarm.js';

describe('alarm arming', () => {
  it('arms after arm() with an injected AudioContext', () => {
    arm({ AudioContextCtor: vi.fn(() => ({ resume: () => {}, currentTime: 0, destination: {} })) });
    expect(isArmed()).toBe(true);
  });
});
