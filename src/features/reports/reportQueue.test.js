import { describe, it, expect, vi } from 'vitest';
import { makeQueue } from './reportQueue.js';

function memStore() {
  let v = [];
  return { get: async () => v, set: async (n) => { v = n; } };
}

describe('reportQueue', () => {
  it('enqueues and lists pending reports', async () => {
    const q = makeQueue(memStore());
    await q.enqueue({ id: '1', category: 'fire', lat: 7, lng: 126 });
    expect((await q.list()).map((r) => r.id)).toEqual(['1']);
  });

  it('flush submits each and removes the successful ones', async () => {
    const store = memStore();
    const q = makeQueue(store);
    await q.enqueue({ id: '1', category: 'fire', lat: 7, lng: 126 });
    await q.enqueue({ id: '2', category: 'safe', lat: 7, lng: 126 });
    const submit = vi.fn().mockResolvedValue(undefined);
    const n = await q.flush(submit);
    expect(n).toBe(2);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(await q.list()).toEqual([]);
  });

  it('keeps items whose submit fails', async () => {
    const q = makeQueue(memStore());
    await q.enqueue({ id: '1', category: 'fire', lat: 7, lng: 126 });
    const submit = vi.fn().mockRejectedValue(new Error('offline'));
    const n = await q.flush(submit);
    expect(n).toBe(0);
    expect((await q.list()).length).toBe(1);
  });
});
