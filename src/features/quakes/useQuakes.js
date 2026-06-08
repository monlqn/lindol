import { useEffect, useState, useRef } from 'react';
import { buildUsgsUrl, parseQuakes } from './quakeApi.js';
import { buildEmscUrl, parseEmscQuakes } from './emscApi.js';
import { mergeQuakes } from './quakeMerge.js';
import { cacheGet, cacheSet } from '../../lib/cache.js';
import { haversineKm } from '../../lib/geo.js';
import { REGION } from '../../config.js';

const CACHE_KEY = 'quakes';

function enrich(quakes, user) {
  return quakes.map((q) => ({ ...q, distanceKm: haversineKm(user, [q.lat, q.lng]) }));
}

// Returns { all, latest, mainshock, aftershocks, status, updatedAt }
// status: 'loading' | 'live' | 'cached' | 'empty'
// Data comes from USGS (primary, cached for offline) merged with EMSC (a second
// independent realtime source for redundancy + sometimes-faster detection).
export function useQuakes(user = REGION.defaultUser) {
  const [state, setState] = useState({
    all: [], latest: null, mainshock: null, aftershocks: [], status: 'loading', updatedAt: null,
  });
  const usgsRef = useRef([]);
  const emscRef = useRef([]);

  useEffect(() => {
    let cancelled = false;

    function recommit(status, updatedAt) {
      if (cancelled) return;
      const merged = mergeQuakes(usgsRef.current, emscRef.current);
      const enriched = enrich(merged, user);
      const byMag = [...enriched].sort((a, b) => b.mag - a.mag);
      const byTime = [...enriched].sort((a, b) => b.time - a.time);
      setState((s) => ({
        all: enriched,
        latest: byTime[0] ?? null,
        mainshock: byMag[0] ?? null,
        aftershocks: byMag.slice(1),
        status: enriched.length ? (status ?? s.status) : 'empty',
        updatedAt: updatedAt ?? s.updatedAt,
      }));
    }

    async function loadUsgs() {
      try {
        const res = await fetch(buildUsgsUrl(REGION));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const quakes = parseQuakes(json);
        const now = Date.now();
        cacheSet(CACHE_KEY, quakes, now);
        usgsRef.current = quakes;
        recommit('live', now);
      } catch {
        const cached = cacheGet(CACHE_KEY);
        if (cached) { usgsRef.current = cached.value; recommit('cached', cached.savedAt); }
        else recommit('empty', null);
      }
    }

    async function loadEmsc() {
      try {
        const res = await fetch(buildEmscUrl(REGION));
        if (!res.ok) return;
        const json = await res.json();
        const quakes = parseEmscQuakes(json);
        emscRef.current = quakes;
        recommit();            // supplementary refresh; keeps current status/updatedAt
      } catch {
        /* EMSC is supplementary - ignore failures, USGS remains the backbone */
      }
    }

    loadUsgs();
    loadEmsc();
    const poll = setInterval(() => { loadUsgs(); loadEmsc(); }, 60000);
    return () => { cancelled = true; clearInterval(poll); };
  }, [user[0], user[1]]);

  return state;
}
