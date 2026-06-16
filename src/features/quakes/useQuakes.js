import { useEffect, useState, useRef } from 'react';
import { buildUsgsUrl, parseQuakes } from './quakeApi.js';
import { buildEmscUrl, parseEmscQuakes, parseEmscWsEvent, EMSC_WS_URL } from './emscApi.js';
import { buildPhivolcsUrl, buildPhivolcsMicroUrl, parsePhivolcsQuakes } from './phivolcsApi.js';
import { mergeQuakes, mergeFreshest } from './quakeMerge.js';
import { latestMajor } from './latestMajor.js';
import { cacheGet, cacheSet } from '../../lib/cache.js';
import { haversineKm } from '../../lib/geo.js';
import { REGION } from '../../config.js';
import { SARANGANI_SEQUENCE, classifyQuakes } from './sequences.js';
import snapshot from './snapshots/sarangani-2026-06.json';

const CACHE_KEY = 'quakes';
const CACHE_KEY_PHIV = 'quakes_phivolcs';
const CACHE_KEY_PHIV_MICRO = 'quakes_phivolcs_micro';

function enrich(quakes, user) {
  return quakes.map((q) => ({ ...q, distanceKm: haversineKm(user, [q.lat, q.lng]) }));
}

// Returns { all, latest, mainshock, aftershocks, status, updatedAt }
// status: 'loading' | 'live' | 'cached' | 'empty'
// Sources are complementary: PHIVOLCS (the local authority, preferred for PH events and the
// small aftershocks the global networks miss) merged with USGS (the dependable backbone,
// cached for offline) and EMSC (a fast independent cross-check). PHIVOLCS is a scrape, so if
// it fails the app falls back to USGS/EMSC and never breaks.
export function useQuakes(user = REGION.defaultUser) {
  const [state, setState] = useState({
    all: [], latest: null, latestMajor: null, mainshock: null, aftershocks: [], other: [], status: 'loading', updatedAt: null,
  });
  const usgsRef = useRef([]);
  const emscRef = useRef([]);
  const phivRef = useRef([]);
  const phivMicroRef = useRef([]); // separate short-window sub-M2.0 micro fetch (PHIVOLCS-only)
  const wsRef = useRef([]); // EMSC WebSocket pushes - newest events, shown instantly

  useEffect(() => {
    let cancelled = false;

    function recommit(status, updatedAt) {
      if (cancelled) return;
      // Collapse the two EMSC streams first, keeping the freshest record per event so a revised
      // magnitude pushed over the WebSocket beats a stale preliminary from the lagging REST poll.
      // Then merge PHIVOLCS first so it still wins on duplicates as the local authority.
      const emscLive = mergeFreshest(wsRef.current, emscRef.current);
      // Build the full M2.0+ feed first (PHIVOLCS authority, then USGS/EMSC), THEN union the micro
      // feed in last as `extra`. Merging micro last means a sub-M2.0 micro can never absorb a real
      // M2.0+ event via sameQuake; only genuinely-new micro events are added.
      const live0 = mergeQuakes(mergeQuakes(phivRef.current, usgsRef.current), emscLive);
      const live = mergeQuakes(live0, phivMicroRef.current);
      // Merge the durable week-1 snapshot (keeps perishable PHIVOLCS data after it ages off the
      // live bulletin), then the static mainshock anchor (so the M7.8 can never disappear).
      const withSnapshot = mergeQuakes(live, snapshot);
      const withAnchor = mergeQuakes(withSnapshot, [SARANGANI_SEQUENCE.mainshock]);
      const enriched = enrich(withAnchor, user);
      const { mainshock, aftershocks, other } = classifyQuakes(enriched, SARANGANI_SEQUENCE);
      const byTime = [...enriched].sort((a, b) => b.time - a.time);
      setState((s) => ({
        all: enriched,
        latest: byTime[0] ?? null,
        latestMajor: latestMajor(byTime, REGION.majorMinMag),
        mainshock,
        aftershocks,
        other,
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

    async function loadPhivolcs() {
      try {
        const res = await fetch(buildPhivolcsUrl(REGION));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const quakes = parsePhivolcsQuakes(json);
        if (quakes.length) {
          const now = Date.now();
          cacheSet(CACHE_KEY_PHIV, quakes, now);
          phivRef.current = quakes;
          recommit('live', now);
        }
      } catch {
        // Scrape can fail (PHIVOLCS down or page changed): use the last good copy if we have one,
        // otherwise stay silent and let USGS/EMSC carry the app.
        const cached = cacheGet(CACHE_KEY_PHIV);
        if (cached && !phivRef.current.length) { phivRef.current = cached.value; recommit(); }
      }
    }

    // Supplementary: recent sub-M2.0 micro quakes (PHIVOLCS-only, short window). Never breaks the
    // app - on failure we keep the last good copy and the main feeds carry on.
    async function loadPhivolcsMicro() {
      try {
        const res = await fetch(buildPhivolcsMicroUrl(REGION));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const quakes = parsePhivolcsQuakes(await res.json());
        if (quakes.length) {
          cacheSet(CACHE_KEY_PHIV_MICRO, quakes, Date.now());
          phivMicroRef.current = quakes;
          recommit();
        }
      } catch {
        const cached = cacheGet(CACHE_KEY_PHIV_MICRO);
        if (cached && !phivMicroRef.current.length) { phivMicroRef.current = cached.value; recommit(); }
      }
    }

    // EMSC real-time WebSocket: push new significant quakes the instant they're detected, instead
    // of waiting up to a minute for the next poll. Filtered to our region; the polls are the backstop.
    let ws = null;
    let wsRetry = null;
    let lastBeat = 0; // last time the socket opened or delivered a frame; drives the liveness check
    function connectWs() {
      if (cancelled || typeof WebSocket === 'undefined') return;
      clearTimeout(wsRetry);
      try {
        ws = new WebSocket(EMSC_WS_URL);
        lastBeat = Date.now();
        ws.onopen = () => { lastBeat = Date.now(); };
        ws.onmessage = (ev) => {
          lastBeat = Date.now();
          let q;
          try { q = parseEmscWsEvent(JSON.parse(ev.data)); } catch { return; }
          if (!q) return;
          const { bbox, minMagnitude, windowDays } = REGION;
          if (q.mag < minMagnitude) return;
          if (q.lat < bbox.minLat || q.lat > bbox.maxLat || q.lng < bbox.minLng || q.lng > bbox.maxLng) return;
          const cutoff = Date.now() - windowDays * 86400000;
          wsRef.current = [q, ...wsRef.current.filter((x) => x.id !== q.id)]
            .filter((x) => x.time >= cutoff)
            .slice(0, 200);
          recommit('live', Date.now());
        };
        ws.onclose = () => { if (!cancelled) { clearTimeout(wsRetry); wsRetry = setTimeout(connectWs, 8000); } };
        ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
      } catch { /* WebSocket unavailable - polls cover it */ }
    }

    // Liveness watchdog: a silently-dropped socket (phone sleep, network switch) may never fire
    // onclose, stranding the app on the slower 60s REST poll. Recycle the connection if it isn't
    // OPEN, or if it's gone quiet long enough to likely be half-open. The 60s polls are the backstop.
    function checkWs() {
      if (cancelled || typeof WebSocket === 'undefined') return;
      const state = ws ? ws.readyState : WebSocket.CLOSED;
      const quiet = Date.now() - lastBeat > 5 * 60000;
      if (state === WebSocket.CLOSED || state === WebSocket.CLOSING || (state === WebSocket.OPEN && quiet)) {
        try { if (ws) { ws.onclose = null; ws.close(); } } catch { /* ignore */ }
        connectWs();
      }
    }

    loadUsgs();
    loadEmsc();
    loadPhivolcs();
    loadPhivolcsMicro();
    connectWs();
    const poll = setInterval(() => { loadUsgs(); loadEmsc(); loadPhivolcs(); loadPhivolcsMicro(); }, 60000);
    const wsHealth = setInterval(checkWs, 30000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(wsHealth);
      clearTimeout(wsRetry);
      try { if (ws) { ws.onclose = null; ws.close(); } } catch { /* ignore */ }
    };
  }, [user[0], user[1]]);

  return state;
}
