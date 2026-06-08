import { useEffect, useState } from 'react';
import { buildUsgsUrl, parseQuakes } from './quakeApi.js';
import { cacheGet, cacheSet } from '../../lib/cache.js';
import { haversineKm } from '../../lib/geo.js';
import { REGION } from '../../config.js';

const CACHE_KEY = 'quakes';

function enrich(quakes, user) {
  return quakes.map((q) => ({ ...q, distanceKm: haversineKm(user, [q.lat, q.lng]) }));
}

// Returns { mainshock, aftershocks, all, status, updatedAt }
// status: 'loading' | 'live' | 'cached' | 'empty'
export function useQuakes(user = REGION.defaultUser) {
  const [state, setState] = useState({
    all: [], mainshock: null, aftershocks: [], status: 'loading', updatedAt: null,
  });

  useEffect(() => {
    let cancelled = false;

    function commit(quakes, status, updatedAt) {
      if (cancelled) return;
      const enriched = enrich(quakes, user);
      const byMag = [...enriched].sort((a, b) => b.mag - a.mag);
      setState({
        all: enriched,
        mainshock: byMag[0] ?? null,
        aftershocks: byMag.slice(1),
        status: enriched.length ? status : 'empty',
        updatedAt,
      });
    }

    async function load() {
      try {
        const res = await fetch(buildUsgsUrl(REGION));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const quakes = parseQuakes(json);
        const now = Date.now();
        cacheSet(CACHE_KEY, quakes, now);
        commit(quakes, 'live', now);
      } catch {
        const cached = cacheGet(CACHE_KEY);
        if (cached) commit(cached.value, 'cached', cached.savedAt);
        else setState((s) => ({ ...s, status: 'empty' }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user[0], user[1]]);

  return state;
}
