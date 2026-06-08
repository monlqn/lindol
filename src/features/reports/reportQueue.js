import { get, set } from 'idb-keyval';

const KEY = 'lindol:report-queue';

const idbStore = {
  get: async () => (await get(KEY)) ?? [],
  set: (v) => set(KEY, v),
};

export function makeQueue(store = idbStore) {
  return {
    async enqueue(report) {
      const q = await store.get();
      await store.set([...q, report]);
    },
    async list() {
      return store.get();
    },
    async flush(submit) {
      const q = await store.get();
      const remaining = [];
      let done = 0;
      for (const report of q) {
        try { await submit(report); done += 1; }
        catch { remaining.push(report); }
      }
      await store.set(remaining);
      return done;
    },
  };
}

export const reportQueue = makeQueue();
