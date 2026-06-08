# LINDÓL — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an installable, offline-capable PWA that shows the live USGS earthquake feed for southern Mindanao on a map with an "instrument" readout, plus always-available offline safety guidance — useful with zero other users and zero backend.

**Architecture:** Vite + React single-page PWA. A thin app shell (status bar, masthead, offline banner) renders self-contained feature modules. The `quakes` feature fetches the USGS GeoJSON feed (network-first, cached for offline), and the `safety` feature serves static guidance that is precached. Pure logic (USGS parsing, distance, time, cache) lives in tested `lib/` and feature `*Api` modules; React components consume them. Visual design is ported verbatim from `prototype/index.html` (design source of truth: single typeface Sora, ember accent, "calm seismic instrument" language).

**Tech Stack:** Vite, React 18 (JavaScript), vite-plugin-pwa (Workbox), react-leaflet + leaflet, Vitest + @testing-library/react + jsdom.

**Out of scope (Phase 2):** Supabase, citizen reports, capture flow, sensitivity gate, flagging, offline report queue, admin page. The app shell leaves a slot for the `reports` feature and the Report button is rendered but disabled with a "Coming soon" state.

---

## Reference artifacts

- **Design source of truth:** `prototype/index.html` — all colors, CSS, the seismograph canvas, the Leaflet setup, and the markup for every section already exist there. Tasks below port these into React. When a task says "port from prototype," copy the exact CSS/markup for that block.
- **Spec:** `docs/superpowers/specs/2026-06-08-earthquake-situational-pwa-design.md`.

## Region constants (used across the app)

```
Region center (map):     [7.08, 126.18]
Default user location:    [7.085, 126.052]   // until geolocation added in Phase 2
USGS query bounding box:  lat 4.5 .. 9.5, lng 124.0 .. 128.0  (southern Mindanao + offshore trench)
USGS min magnitude:       2.5
USGS feed window:         past 7 days
```

## File Structure

```
C:\Projects\Earthquake\
  package.json                vite scripts + deps
  vite.config.js              react + vite-plugin-pwa config (manifest, workbox runtime caching)
  index.html                  Vite entry (root) — NOTE: distinct from prototype/index.html
  .gitignore                  node_modules, dist
  public/
    icons/icon-192.png        PWA icon (placeholder ok in P1)
    icons/icon-512.png        PWA icon
  src/
    main.jsx                  React/DOM mount
    App.jsx                   app shell: composes StatusBar, Masthead, OfflineBanner, feature panels
    config.js                 REGION constants above
    styles/
      tokens.css              :root design tokens (ported from prototype)
      global.css              base, background atmosphere/grain, .app frame, section/label styles
    lib/
      geo.js                  haversineKm(a,b), formatKm(km)
      geo.test.js
      time.js                 relativeTime(date, now), formatClock(date)
      time.test.js
      cache.js                cacheGet(key), cacheSet(key, value) — localStorage w/ timestamp
      cache.test.js
      useOnline.js            React hook: boolean online state from navigator/online-offline events
    components/
      StatusBar.jsx           live/offline pill, last-updated, (P2) settings
      Masthead.jsx            wordmark + <Seismograph/> + tagline
      Seismograph.jsx         canvas scrolling trace (ported from prototype JS)
      OfflineBanner.jsx       shown when offline; "data as of <time>"
      SectionLabel.jsx        the uppercase section header element
      ReportButtonStub.jsx    fixed FAB, disabled "Reporting — coming soon"
    features/
      quakes/
        quakeApi.js           buildUsgsUrl(region), parseQuakes(geojson) -> Quake[]
        quakeApi.test.js
        useQuakes.js          hook: fetch (network-first) + cache fallback + distance enrich
        QuakeHero.jsx         latest-event instrument card
        QuakeMap.jsx          react-leaflet map: epicenter, aftershocks, "you" marker
      safety/
        safetyData.js         array of {title, body, icon} safety tips
        SafetyPanel.jsx       renders safety cards + "works offline" note
```

### The `Quake` shape (returned by `parseQuakes`, consumed everywhere)

```js
// One earthquake, normalized from a USGS GeoJSON feature.
{
  id: string,          // feature.id
  mag: number,         // feature.properties.mag
  place: string,       // feature.properties.place
  time: number,        // feature.properties.time (epoch ms)
  depthKm: number,     // feature.geometry.coordinates[2]
  lat: number,         // coordinates[1]
  lng: number,         // coordinates[0]
}
```

`useQuakes` sorts by `mag` descending to pick `mainshock = quakes[0]`, and returns `{ mainshock, aftershocks, all, status, updatedAt }` where `status` is `'live' | 'cached' | 'empty'`.

---

## Task 1: Scaffold Vite + React project

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `src/main.jsx`, `src/App.jsx`

- [ ] **Step 1: Initialize the project with Vite**

Run in `C:\Projects\Earthquake`:
```bash
npm create vite@latest . -- --template react
```
If prompted that the directory is not empty, choose **"Ignore files and continue"** (it must keep `docs/` and `prototype/`). This generates `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, etc.

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install leaflet react-leaflet
npm install -D vite-plugin-pwa vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Replace `index.html` `<head>` to load Sora and set title**

Replace the contents of root `index.html` with:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#14110E" />
  <title>LINDÓL — Southern Mindanao Live Earthquake Watch</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: Replace `src/App.jsx` with a placeholder shell**

```jsx
export default function App() {
  return <div className="app"><p style={{ padding: 24 }}>LINDÓL booting…</p></div>;
}
```

- [ ] **Step 5: Verify dev server runs**

Run: `npm run dev`
Expected: Vite prints a localhost URL; opening it shows "LINDÓL booting…". Stop the server (Ctrl+C).

- [ ] **Step 6: Configure `.gitignore` and commit**

Ensure `.gitignore` contains `node_modules` and `dist`. Then:
```bash
git add -A
git commit -m "chore: scaffold Vite + React PWA project"
```

---

## Task 2: Wire up Vitest

**Files:**
- Modify: `vite.config.js`
- Modify: `package.json` (scripts)
- Create: `src/test/setup.js`

- [ ] **Step 1: Add a trivial failing test**

Create `src/lib/geo.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { haversineKm } from './geo.js';

describe('haversineKm', () => {
  it('is ~0 for identical points', () => {
    expect(haversineKm([7, 126], [7, 126])).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: Configure Vitest in `vite.config.js`**

Set the file to:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
```

Create `src/test/setup.js`:
```js
import '@testing-library/jest-dom';
```

- [ ] **Step 3: Add test script**

In `package.json` `"scripts"`, add: `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 4: Run the test, expect failure**

Run: `npm test`
Expected: FAIL — `haversineKm` is not defined / cannot import `./geo.js`.

- [ ] **Step 5: Commit the harness**

```bash
git add -A
git commit -m "test: configure vitest harness"
```

---

## Task 3: `lib/geo.js` — distance + formatting (TDD)

**Files:**
- Create: `src/lib/geo.js`
- Test: `src/lib/geo.test.js` (extend from Task 2)

- [ ] **Step 1: Write the failing tests**

Replace `src/lib/geo.test.js` with:
```js
import { describe, it, expect } from 'vitest';
import { haversineKm, formatKm } from './geo.js';

describe('haversineKm', () => {
  it('is ~0 for identical points', () => {
    expect(haversineKm([7, 126], [7, 126])).toBeCloseTo(0, 5);
  });
  it('matches a known distance (Davao ~ epicenter)', () => {
    // [7.085,126.052] -> [7.05,126.30] is ~28 km
    const d = haversineKm([7.085, 126.052], [7.05, 126.30]);
    expect(d).toBeGreaterThan(24);
    expect(d).toBeLessThan(32);
  });
});

describe('formatKm', () => {
  it('rounds whole km with unit', () => {
    expect(formatKm(38.4)).toBe('38 km');
  });
  it('shows one decimal under 10 km', () => {
    expect(formatKm(0.42)).toBe('0.4 km');
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement `src/lib/geo.js`**

```js
// Great-circle distance between two [lat, lng] points, in kilometers.
export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Human-readable distance: one decimal under 10 km, whole km otherwise.
export function formatKm(km) {
  const n = km < 10 ? km.toFixed(1) : Math.round(km).toString();
  return `${n} km`;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS (all geo tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo.js src/lib/geo.test.js
git commit -m "feat: add geo distance + formatting helpers"
```

---

## Task 4: `lib/time.js` — relative + clock formatting (TDD)

**Files:**
- Create: `src/lib/time.js`, `src/lib/time.test.js`

- [ ] **Step 1: Write failing tests**

```js
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
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — not defined.

- [ ] **Step 3: Implement `src/lib/time.js`**

```js
// Compact relative time: "now" | "N min ago" | "Nh ago" | "Nd ago".
export function relativeTime(epochMs, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - epochMs) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// 24-hour HH:MM clock, fixed to Philippine time so readouts are local.
export function formatClock(epochMs) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Manila',
  }).format(new Date(epochMs));
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.js src/lib/time.test.js
git commit -m "feat: add relative + clock time formatting"
```

---

## Task 5: `lib/cache.js` — last-known-data cache (TDD)

**Files:**
- Create: `src/lib/cache.js`, `src/lib/cache.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { cacheGet, cacheSet } from './cache.js';

beforeEach(() => localStorage.clear());

describe('cache', () => {
  it('returns null for a missing key', () => {
    expect(cacheGet('nope')).toBeNull();
  });
  it('round-trips value + timestamp', () => {
    cacheSet('q', [{ id: 'a' }], 1000);
    const got = cacheGet('q');
    expect(got.value).toEqual([{ id: 'a' }]);
    expect(got.savedAt).toBe(1000);
  });
  it('returns null on corrupt data', () => {
    localStorage.setItem('lindol:bad', '{not json');
    expect(cacheGet('bad')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — not defined.

- [ ] **Step 3: Implement `src/lib/cache.js`**

```js
const PREFIX = 'lindol:';

// Store a value with the time it was saved, so the UI can show "data as of …".
export function cacheSet(key, value, savedAt = Date.now()) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, savedAt }));
  } catch {
    /* quota / private mode — ignore, cache is best-effort */
  }
}

// Returns { value, savedAt } or null if missing/corrupt.
export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cache.js src/lib/cache.test.js
git commit -m "feat: add localStorage last-known cache helper"
```

---

## Task 6: `config.js` — region constants

**Files:**
- Create: `src/config.js`

- [ ] **Step 1: Create the config module**

```js
// Southern Mindanao region settings shared across features.
export const REGION = {
  center: [7.08, 126.18],
  defaultUser: [7.085, 126.052],
  bbox: { minLat: 4.5, maxLat: 9.5, minLng: 124.0, maxLng: 128.0 },
  minMagnitude: 2.5,
  windowDays: 7,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/config.js
git commit -m "feat: add region config constants"
```

---

## Task 7: `quakes/quakeApi.js` — USGS URL + parser (TDD)

**Files:**
- Create: `src/features/quakes/quakeApi.js`, `src/features/quakes/quakeApi.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { buildUsgsUrl, parseQuakes } from './quakeApi.js';
import { REGION } from '../../config.js';

describe('buildUsgsUrl', () => {
  it('includes bbox, min magnitude, and geojson format', () => {
    const url = buildUsgsUrl(REGION);
    expect(url).toContain('format=geojson');
    expect(url).toContain('minlatitude=4.5');
    expect(url).toContain('maxlongitude=128');
    expect(url).toContain('minmagnitude=2.5');
  });
});

describe('parseQuakes', () => {
  const geojson = {
    features: [
      { id: 'a', properties: { mag: 6.9, place: '23 km E of Davao Oriental', time: 1000 },
        geometry: { coordinates: [126.3, 7.05, 31] } },
      { id: 'b', properties: { mag: 4.3, place: 'near coast', time: 2000 },
        geometry: { coordinates: [126.34, 7.1, 10] } },
    ],
  };
  it('normalizes features into Quake objects', () => {
    const out = parseQuakes(geojson);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: 'a', mag: 6.9, depthKm: 31, lat: 7.05, lng: 126.3 });
  });
  it('drops features with no magnitude', () => {
    const out = parseQuakes({ features: [{ id: 'x', properties: { mag: null, time: 1 }, geometry: { coordinates: [1, 2, 3] } }] });
    expect(out).toHaveLength(0);
  });
  it('returns [] for empty/invalid input', () => {
    expect(parseQuakes(null)).toEqual([]);
    expect(parseQuakes({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — not defined.

- [ ] **Step 3: Implement `src/features/quakes/quakeApi.js`**

```js
const BASE = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

// Build a USGS FDSN query URL for the region's bounding box + recency window.
export function buildUsgsUrl(region) {
  const { bbox, minMagnitude, windowDays } = region;
  const start = new Date(Date.now() - windowDays * 86400000).toISOString();
  const p = new URLSearchParams({
    format: 'geojson',
    starttime: start,
    minlatitude: String(bbox.minLat),
    maxlatitude: String(bbox.maxLat),
    minlongitude: String(bbox.minLng),
    maxlongitude: String(bbox.maxLng),
    minmagnitude: String(minMagnitude),
    orderby: 'time',
  });
  return `${BASE}?${p.toString()}`;
}

// Normalize a USGS GeoJSON FeatureCollection into Quake[] (see plan header).
export function parseQuakes(geojson) {
  const features = geojson && Array.isArray(geojson.features) ? geojson.features : [];
  return features
    .filter((f) => f && f.properties && typeof f.properties.mag === 'number')
    .map((f) => ({
      id: f.id,
      mag: f.properties.mag,
      place: f.properties.place || 'Unknown location',
      time: f.properties.time,
      depthKm: f.geometry?.coordinates?.[2] ?? null,
      lat: f.geometry?.coordinates?.[1],
      lng: f.geometry?.coordinates?.[0],
    }));
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/quakes/quakeApi.js src/features/quakes/quakeApi.test.js
git commit -m "feat: add USGS url builder + geojson parser"
```

---

## Task 8: `lib/useOnline.js` + `useQuakes.js` hooks

**Files:**
- Create: `src/lib/useOnline.js`
- Create: `src/features/quakes/useQuakes.js`

- [ ] **Step 1: Implement `src/lib/useOnline.js`**

```js
import { useEffect, useState } from 'react';

// Tracks navigator.onLine, updating on the browser online/offline events.
export function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}
```

- [ ] **Step 2: Implement `src/features/quakes/useQuakes.js`**

Network-first with cache fallback; enriches each quake with distance from the user and selects the mainshock by magnitude.

```js
import { useEffect, useState } from 'react';
import { buildUsgsUrl, parseQuakes } from './quakeApi.js';
import { cacheGet, cacheSet } from '../../lib/cache.js';
import { haversineKm } from '../../lib/geo.js';
import { REGION } from '../../config.js';

const CACHE_KEY = 'quakes';

function enrich(quakes, user) {
  return quakes.map((q) => ({ ...q, distanceKm: haversineKm(user, [q.lat, q.lng]) }));
}

// { mainshock, aftershocks, all, status, updatedAt }
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
```

- [ ] **Step 3: Sanity-check it compiles**

Run: `npm run build`
Expected: build succeeds (no import errors). (Hooks are exercised via the UI; logic underneath is already unit-tested in Tasks 3,5,7.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/useOnline.js src/features/quakes/useQuakes.js
git commit -m "feat: add online + quakes data hooks"
```

---

## Task 9: Design system — `tokens.css` + `global.css`

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`
- Modify: `src/main.jsx` (import the stylesheets)

- [ ] **Step 1: Create `src/styles/tokens.css`**

Port the `:root` block from `prototype/index.html` (lines ~17–49) verbatim:
```css
:root{
  --bone:#EFEAE0;
  --paper:#F7F3EA;
  --card:#FCFAF4;
  --ink:#16120D;
  --ink-soft:#5B5347;
  --ink-faint:#8A8175;
  --line:rgba(22,18,13,.12);
  --line-strong:rgba(22,18,13,.22);
  --ember:#E0521B;
  --ember-deep:#B83C10;
  --ember-wash:#F8E3D6;
  --c-damage:#9A5B16;
  --c-road:#C08A1E;
  --c-fire:#E0521B;
  --c-help:#CC2A2A;
  --c-safe:#3F7D43;
  --shadow-sm:0 1px 2px rgba(22,18,13,.06), 0 2px 8px rgba(22,18,13,.05);
  --shadow-md:0 8px 30px rgba(22,18,13,.13), 0 2px 6px rgba(22,18,13,.07);
  --shadow-lg:0 24px 60px rgba(22,18,13,.22);
  --app-w:440px;
  --r:16px;
  --font:"Sora",ui-sans-serif,system-ui,sans-serif;
  --mono:var(--font);
}
```

- [ ] **Step 2: Create `src/styles/global.css`**

Port from `prototype/index.html` the following blocks verbatim (they are framework-agnostic):
- the reset (`*{box-sizing…}`, `html,body`), `body`, `body::before`, `body::after` (lines ~51–75)
- `.app` frame (the phone column)
- `.statusbar`, `.live-pill`, `.live-dot`, `@keyframes ping`, `.app.off …`
- `.masthead`, `.brandrow`, `.wordmark`, `.tagline`, `.seismo`
- `.scroll`, `.offline-banner`, `.app.off .offline-banner`
- `section`, `.sec-label`
- `.quake-card` and all `.qc-*`, `.mag-*` rules
- `.mapwrap`, `#map`, `.maptools`, `.chip`, `.legend`, and the Leaflet marker classes `.epi/.after/.rpin` + `@keyframes epiPulse`
- `.safety-grid`, `.safety`, `.safety-note`
- `.fab` and `.fab button`
- the `.reveal` staggered load-in rules

Leave out (Phase 2 only): `.feed/.report/.photo/.rp-*/.flagbtn`, `.scrim/.sheet/.catgrid/.catopt/textarea/.camera/.submit`, `.toast`. (Porting them now is harmless but unused; prefer to omit to keep the file focused.)

- [ ] **Step 3: Import styles in `src/main.jsx`**

Ensure `src/main.jsx` imports them before rendering:
```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
);
```
Delete the default `src/index.css` / `src/App.css` imports if present.

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/styles src/main.jsx
git commit -m "feat: port LINDÓL design tokens + global styles"
```

---

## Task 10: Shell components — StatusBar, Masthead, Seismograph, OfflineBanner, SectionLabel, ReportButtonStub

**Files:**
- Create the six component files under `src/components/`.

- [ ] **Step 1: `src/components/Seismograph.jsx`**

Port the prototype's seismograph canvas IIFE (the `(function(){ const cv=… })()` block) into a React component driving a `<canvas className="seismo">` via a ref + `requestAnimationFrame`, cleaned up on unmount.

```jsx
import { useEffect, useRef } from 'react';

export default function Seismograph() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    const cx = cv.getContext('2d');
    let raf, W, H;
    const dims = () => { const r = cv.getBoundingClientRect();
      cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio;
      cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); W = r.width; H = r.height; };
    dims();
    const N = 160, pts = Array(N).fill(0);
    let t = 0, spikeT = 40;
    const step = () => {
      t++;
      let v = (Math.sin(t * 0.18) + Math.sin(t * 0.37)) * 0.06 + (Math.random() - 0.5) * 0.08;
      spikeT--; if (spikeT <= 0) spikeT = 60 + Math.random() * 120;
      if (spikeT < 6) v += (Math.random() - 0.5) * (spikeT / 6) * 1.7;
      pts.push(v); if (pts.length > N) pts.shift();
      cx.clearRect(0, 0, W, H);
      cx.strokeStyle = 'rgba(224,82,27,.12)'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(0, H / 2); cx.lineTo(W, H / 2); cx.stroke();
      cx.beginPath();
      pts.forEach((p, i) => { const x = (i / (N - 1)) * W, y = H / 2 - p * H * 0.46; i ? cx.lineTo(x, y) : cx.moveTo(x, y); });
      cx.strokeStyle = '#E0521B'; cx.lineWidth = 1.6; cx.shadowColor = 'rgba(224,82,27,.6)';
      cx.shadowBlur = 6; cx.lineJoin = 'round'; cx.stroke(); cx.shadowBlur = 0;
      raf = requestAnimationFrame(step);
    };
    step();
    const onResize = () => dims();
    addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', onResize); };
  }, []);
  return <canvas className="seismo" ref={ref} />;
}
```

- [ ] **Step 2: `src/components/Masthead.jsx`**

```jsx
import Seismograph from './Seismograph.jsx';

export default function Masthead() {
  return (
    <header className="masthead">
      <div className="brandrow">
        <div className="wordmark">LIND<b>Ó</b>L</div>
        <div className="tagline">Southern Mindanao · live earthquake watch</div>
      </div>
      <Seismograph />
    </header>
  );
}
```

- [ ] **Step 3: `src/components/StatusBar.jsx`**

```jsx
import { formatClock, relativeTime } from '../lib/time.js';

export default function StatusBar({ online, updatedAt }) {
  const label = online ? 'LIVE' : 'OFFLINE';
  const stamp = updatedAt
    ? `UPDATED ${formatClock(updatedAt)} · ${relativeTime(updatedAt)}`
    : 'UPDATING…';
  return (
    <div className="statusbar">
      <span className="live-pill"><span className="live-dot" /><span className="ls">{label}</span></span>
      <span>{stamp}</span>
      <span style={{ opacity: 0.5 }}>v0.1</span>
    </div>
  );
}
```

- [ ] **Step 4: `src/components/OfflineBanner.jsx`**

```jsx
import { formatClock } from '../lib/time.js';

export default function OfflineBanner({ updatedAt }) {
  return (
    <div className="offline-banner">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M1 1l22 22M16.7 11.3A6 6 0 0 0 8 9M5 12.5A10 10 0 0 1 8 11M12 20h.01" />
      </svg>
      <span>Offline — showing data as of <b>{updatedAt ? formatClock(updatedAt) : '—'}</b>.</span>
    </div>
  );
}
```

- [ ] **Step 5: `src/components/SectionLabel.jsx`**

```jsx
export default function SectionLabel({ children }) {
  return <div className="sec-label">{children}</div>;
}
```

- [ ] **Step 6: `src/components/ReportButtonStub.jsx`**

```jsx
export default function ReportButtonStub() {
  return (
    <div className="fab">
      <button disabled title="Citizen reports arrive in the next release">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M12 8v8M8 12h8" /><circle cx="12" cy="12" r="9" />
        </svg>
        Reporting — coming soon
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Build check + commit**

Run: `npm run build`
Expected: success.
```bash
git add src/components
git commit -m "feat: add shell components (statusbar, masthead, seismograph, banners)"
```

---

## Task 11: `quakes/QuakeHero.jsx` — instrument card

**Files:**
- Create: `src/features/quakes/QuakeHero.jsx`

- [ ] **Step 1: Implement the hero**

Port the `.quake-card` markup from the prototype, driven by the `mainshock` Quake. Position the `.mag-bar` indicator from magnitude (clamp 3–8 → 0–100%).

```jsx
import { formatKm } from '../../lib/geo.js';
import { formatClock, relativeTime } from '../../lib/time.js';

export default function QuakeHero({ quake }) {
  if (!quake) {
    return <div className="quake-card"><div className="qc-top"><div className="qc-meta">
      <div className="qc-place">No recent quakes</div>
      <div className="qc-sub">No events ≥ M2.5 in the last 7 days.</div>
    </div></div></div>;
  }
  const pct = Math.min(100, Math.max(0, ((quake.mag - 3) / 5) * 100));
  return (
    <div className="quake-card">
      <div className="qc-top">
        <div className="mag-block">
          <div className="mag-num">{quake.mag.toFixed(1)}</div>
          <div className="mag-scale">Mw</div>
          <div className="mag-bar"><i style={{ left: `${pct}%` }} /></div>
        </div>
        <div className="qc-meta">
          <div className="qc-place">{quake.place}</div>
          <div className="qc-sub">Source: USGS</div>
        </div>
      </div>
      <div className="qc-grid">
        <div className="qc-cell"><div className="k">Time</div>
          <div className="v">{formatClock(quake.time)}<span style={{ color: 'var(--ink-faint)' }}> · {relativeTime(quake.time)}</span></div></div>
        <div className="qc-cell"><div className="k">Depth</div>
          <div className="v">{quake.depthKm != null ? `${Math.round(quake.depthKm)} km` : '—'}</div></div>
        <div className="qc-cell"><div className="k">From you</div>
          <div className="v warn">≈ {formatKm(quake.distanceKm)}</div></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check + commit**

Run: `npm run build`
Expected: success.
```bash
git add src/features/quakes/QuakeHero.jsx
git commit -m "feat: add quake instrument hero card"
```

---

## Task 12: `quakes/QuakeMap.jsx` — Leaflet map

**Files:**
- Create: `src/features/quakes/QuakeMap.jsx`

- [ ] **Step 1: Implement the map with react-leaflet**

Use divIcons matching the prototype's `.epi` / `.after` markers. Epicenter = the mainshock; aftershocks = the rest.

```jsx
import { MapContainer, TileLayer, Marker, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { REGION } from '../../config.js';

const epiIcon = L.divIcon({
  className: '', iconSize: [20, 20], iconAnchor: [10, 10],
  html: '<div class="epi"><div class="ring"></div><div class="core"></div></div>',
});
const afterIcon = L.divIcon({
  className: '', iconSize: [11, 11], iconAnchor: [5, 5],
  html: '<div class="after"></div>',
});

export default function QuakeMap({ mainshock, aftershocks, user = REGION.defaultUser }) {
  return (
    <div className="mapwrap">
      <MapContainer center={REGION.center} zoom={9} zoomControl={false}
        attributionControl={false} style={{ height: 280, width: '100%' }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" maxZoom={19} />
        {mainshock && (
          <Marker position={[mainshock.lat, mainshock.lng]} icon={epiIcon}>
            <Popup><b>M{mainshock.mag.toFixed(1)}</b> · main shock</Popup>
          </Marker>
        )}
        {aftershocks.map((q) => (
          <Marker key={q.id} position={[q.lat, q.lng]} icon={afterIcon}>
            <Popup>Aftershock M{q.mag.toFixed(1)}</Popup>
          </Marker>
        ))}
        <CircleMarker center={user} radius={6} pathOptions={{ color: '#14110D', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
          <Popup>You are here</Popup>
        </CircleMarker>
      </MapContainer>
      <div className="legend">
        <span><i style={{ background: 'var(--ember)' }} />Epicenter</span>
        <span><i style={{ background: 'rgba(224,82,27,.55)' }} />Aftershock</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check + commit**

Run: `npm run build`
Expected: success.
```bash
git add src/features/quakes/QuakeMap.jsx
git commit -m "feat: add live quake map (leaflet)"
```

---

## Task 13: `safety` feature

**Files:**
- Create: `src/features/safety/safetyData.js`, `src/features/safety/SafetyPanel.jsx`

- [ ] **Step 1: `safetyData.js`**

```js
// Static guidance — always available offline (precached, no network).
export const SAFETY_TIPS = [
  { title: 'Drop, Cover, Hold On',
    body: 'Drop to your knees, take cover under sturdy furniture, and hold on until shaking stops.' },
  { title: 'Expect aftershocks',
    body: 'Move away from buildings, walls, and power lines once outside. Aftershocks can be strong.' },
  { title: 'If near the coast — go high',
    body: "Strong offshore quakes can cause tsunamis. Move to higher ground immediately, don't wait for an alert." },
];
```

- [ ] **Step 2: `SafetyPanel.jsx`**

Port `.safety-grid` / `.safety` / `.safety-note` markup; map over `SAFETY_TIPS`. A single shield SVG per card is fine.

```jsx
import { SAFETY_TIPS } from './safetyData.js';

export default function SafetyPanel() {
  return (
    <div>
      <div className="safety-grid">
        {SAFETY_TIPS.map((t) => (
          <div className="safety" key={t.title}>
            <div className="ic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div><h4>{t.title}</h4><p>{t.body}</p></div>
          </div>
        ))}
      </div>
      <div className="safety-note">These tips stay available even with no signal.</div>
    </div>
  );
}
```

- [ ] **Step 3: Build check + commit**

Run: `npm run build`
Expected: success.
```bash
git add src/features/safety
git commit -m "feat: add offline safety panel"
```

---

## Task 14: Assemble `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Compose the shell + features**

```jsx
import StatusBar from './components/StatusBar.jsx';
import Masthead from './components/Masthead.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import SectionLabel from './components/SectionLabel.jsx';
import ReportButtonStub from './components/ReportButtonStub.jsx';
import QuakeHero from './features/quakes/QuakeHero.jsx';
import QuakeMap from './features/quakes/QuakeMap.jsx';
import SafetyPanel from './features/safety/SafetyPanel.jsx';
import { useQuakes } from './features/quakes/useQuakes.js';
import { useOnline } from './lib/useOnline.js';

export default function App() {
  const online = useOnline();
  const { mainshock, aftershocks, all, status, updatedAt } = useQuakes();

  return (
    <div className={`app${online ? '' : ' off'}`}>
      <StatusBar online={online} updatedAt={updatedAt} />
      <Masthead />
      <div className="scroll">
        {!online && <OfflineBanner updatedAt={updatedAt} />}

        <section className="reveal">
          <SectionLabel>Latest event{status === 'cached' ? ' · cached' : ''}</SectionLabel>
          <QuakeHero quake={mainshock} />
        </section>

        <section className="reveal">
          <SectionLabel>Live map · {all.length} events nearby</SectionLabel>
          <QuakeMap mainshock={mainshock} aftershocks={aftershocks} />
        </section>

        <section className="reveal">
          <SectionLabel>Safety · works offline</SectionLabel>
          <SafetyPanel />
        </section>
      </div>
      <ReportButtonStub />
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and verify in a real browser**

Run: `npm run dev`
Then (using the Playwright MCP tools or a manual browser at the printed URL):
1. Navigate to the dev URL.
2. Confirm: the seismograph animates, the hero shows a magnitude + "From you" distance, the map renders with at least the user marker, and the safety cards show.
Expected: live USGS data renders (a recent SE-Mindanao quake, or "No recent quakes" if the feed is genuinely empty — both are valid).

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: assemble LINDÓL app shell with quakes + safety"
```

---

## Task 15: PWA — manifest, service worker, offline caching

**Files:**
- Modify: `vite.config.js`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`

- [ ] **Step 1: Add placeholder PWA icons**

Add any 192×192 and 512×512 PNG to `public/icons/` named `icon-192.png` and `icon-512.png` (a solid ember square with "L" is fine for Phase 1; final art later).

- [ ] **Step 2: Configure `vite-plugin-pwa` in `vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'LINDÓL — Southern Mindanao Earthquake Watch',
        short_name: 'LINDÓL',
        theme_color: '#14110E',
        background_color: '#EFEAE0',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/earthquake\.usgs\.gov\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'usgs-feed', expiration: { maxEntries: 20, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /^https:\/\/[abc]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 600, maxAgeSeconds: 1209600 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } },
          },
        ],
      },
    }),
  ],
  test: { globals: true, environment: 'jsdom', setupFiles: './src/test/setup.js' },
});
```

- [ ] **Step 3: Build and preview**

Run: `npm run build` then `npm run preview`
Expected: build emits `sw.js` + `manifest.webmanifest`; preview serves the app.

- [ ] **Step 4: Verify offline behavior**

In the previewed app (Chrome DevTools):
1. Load once with network on (let the map + USGS load).
2. DevTools → Application → Service Workers: confirm the SW is activated.
3. DevTools → Network → set "Offline", reload.
Expected: the app shell, fonts, safety panel, last-known quake hero, and already-viewed map tiles still render; StatusBar shows OFFLINE and the offline banner appears.

- [ ] **Step 5: Commit**

```bash
git add vite.config.js public/icons
git commit -m "feat: add PWA manifest + offline service worker caching"
```

---

## Task 16: Full test pass + final verification

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: all tests green (geo, time, cache, quakeApi).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: success, no warnings about missing imports.

- [ ] **Step 3: Manual smoke test against the prototype**

Open `npm run preview`, compare side-by-side with `prototype/index.html`: typography (Sora), ember accent, seismograph, hero, map, safety cards should match. Differences should only be real (live) data vs mock.

- [ ] **Step 4: Final commit / tag**

```bash
git add -A
git commit -m "chore: phase 1 foundation complete"
git tag v0.1-foundation
```

---

## Self-Review notes (already applied)

- **Spec coverage (Phase 1 portion):** stack ✓ (Task 1), design system ✓ (Task 9–10), USGS live quakes ✓ (Task 7–8,11–12), offline safety ✓ (Task 13), PWA offline read ✓ (Task 15), app-shell + feature-module architecture ✓ (Task 14). Deferred spec items (reports, moderation, offline write-queue, evac centers, admin) are explicitly Phase 2.
- **Type consistency:** the `Quake` shape and `useQuakes` return (`mainshock`/`aftershocks`/`all`/`status`/`updatedAt`) are used identically in Tasks 8, 11, 12, 14. Cache helper is `cacheGet`/`cacheSet` throughout.
- **No placeholders:** every code step contains full code; PWA icons are the only binary asset and are explicitly "placeholder PNG, fine for P1."
```
