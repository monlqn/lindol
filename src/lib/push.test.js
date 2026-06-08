import { describe, it, expect } from 'vitest';
import { urlBase64ToUint8Array } from './push.js';
describe('urlBase64ToUint8Array', () => {
  it('decodes a url-safe base64 VAPID key to bytes', () => {
    expect(Array.from(urlBase64ToUint8Array('AQAB'))).toEqual([1, 0, 1]);
  });
});
