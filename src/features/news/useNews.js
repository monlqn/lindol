import { useEffect, useState } from 'react';
import { cacheGet, cacheSet } from '../../lib/cache.js';

const KEY = 'news';

// Situation-update headlines from our /api/news aggregator (Google News RSS). Cached locally
// so the section still shows something offline. Refreshes every 10 minutes - news is not
// minute-critical, and the CDN cache already keeps Google from being hit per user.
export function useNews() {
  const [state, setState] = useState({ items: [], status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const r = await fetch('/api/news');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (cancelled) return;
        if (j.items?.length) {
          cacheSet(KEY, j.items, Date.now());
          setState({ items: j.items, status: 'live' });
        } else {
          setState((s) => (s.items.length ? s : { items: [], status: 'empty' }));
        }
      } catch {
        if (cancelled) return;
        const c = cacheGet(KEY);
        setState(c?.value?.length ? { items: c.value, status: 'cached' } : { items: [], status: 'empty' });
      }
    }

    load();
    const poll = setInterval(load, 600000);
    return () => { cancelled = true; clearInterval(poll); };
  }, []);

  return state;
}
