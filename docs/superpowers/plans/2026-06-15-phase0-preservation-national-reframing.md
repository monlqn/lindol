# Phase 0: Data Preservation + National Reframing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anchor the M7.8 mainshock so it can never drop off or be mislabeled, snapshot perishable week-1 PHIVOLCS data, and classify quakes into three honest buckets (mainshock / aftershocks / other) so the app becomes a Philippines-wide monitor with the Sarangani sequence highlighted.

**Architecture:** A new static module (`sequences.js`) defines the Sarangani sequence (a pinned mainshock anchor + a spatial/temporal zone) and a pure `classifyQuakes` function. `useQuakes` merges the live feed with a committed week-1 snapshot and the anchor, then classifies. The map and home screen render the new `other` bucket with neutral labels.

**Tech Stack:** React 18 + Vite, Leaflet/react-leaflet, Vitest, plain JS ESM. Quake records share one shape: `{ id, mag, place, time, depthKm, lat, lng, source?, sources?, distanceKm? }`.

---

## File Structure

- Create: `scripts/capture-snapshot.mjs` — one-off Node script that fetches USGS + EMSC + PHIVOLCS for the event window, merges them, and writes the snapshot JSON.
- Create: `src/features/quakes/snapshots/sarangani-2026-06.json` — committed week-1 snapshot (the durable record of perishable PHIVOLCS data).
- Create: `src/features/quakes/sequences.js` — `SARANGANI_SEQUENCE` constant + pure `classifyQuakes`.
- Create: `src/features/quakes/sequences.test.js` — unit tests for `classifyQuakes`.
- Modify: `src/features/quakes/useQuakes.js` — inject snapshot + anchor, return the 3-bucket shape.
- Modify: `src/config.js` — widen `windowDays`.
- Modify: `src/features/quakes/QuakeMap.jsx` — accept and render the `other` bucket with neutral labels.
- Modify: `src/App.jsx` — pass `other` to the map, reframe the copy.

No change needed: `QuakeList.jsx` already labels rows neutrally (place + magnitude, no "aftershock" word), so it works as-is for the national framing.

---

## Task 1: Capture and commit the week-1 snapshot

This must run first: PHIVOLCS data is perishable, and the mainshock anchor values in Task 2 are read out of this file.

**Files:**
- Create: `scripts/capture-snapshot.mjs`
- Create: `src/features/quakes/snapshots/sarangani-2026-06.json`

- [ ] **Step 1: Write the capture script**

Create `scripts/capture-snapshot.mjs`:

```js
// One-off snapshot of the M7.8 Sarangani sequence + concurrent PH seismicity.
// PHIVOLCS is perishable (live scrape, no archive), so we freeze it now. USGS/EMSC
// are archived upstream but we capture them too so the snapshot is self-sufficient.
// Run: LINDOL_BASE="https://<your-vercel-domain>" node scripts/capture-snapshot.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { parseQuakes } from '../src/features/quakes/quakeApi.js';
import { parseEmscQuakes } from '../src/features/quakes/emscApi.js';
import { parsePhivolcsQuakes } from '../src/features/quakes/phivolcsApi.js';
import { mergeQuakes } from '../src/features/quakes/quakeMerge.js';

const START = '2026-06-07';          // a day before the 8 June mainshock, to be safe
const BBOX = { minLat: 4.5, maxLat: 21.5, minLng: 116.0, maxLng: 127.0 };
const MIN = 2.0;
const base = process.env.LINDOL_BASE || '';

const usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson`
  + `&starttime=${START}&minlatitude=${BBOX.minLat}&maxlatitude=${BBOX.maxLat}`
  + `&minlongitude=${BBOX.minLng}&maxlongitude=${BBOX.maxLng}&minmagnitude=${MIN}&orderby=time`;
const emscUrl = `https://www.seismicportal.eu/fdsnws/event/1/query?format=json`
  + `&starttime=${START}&minlatitude=${BBOX.minLat}&maxlatitude=${BBOX.maxLat}`
  + `&minlongitude=${BBOX.minLng}&maxlongitude=${BBOX.maxLng}&minmagnitude=${MIN}&orderby=time&limit=2000`;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  let usgs = [], emsc = [], phiv = [];
  try { usgs = parseQuakes(await getJson(usgsUrl)); }
  catch (e) { console.warn('USGS failed:', e.message); }
  try { emsc = parseEmscQuakes(await getJson(emscUrl)); }
  catch (e) { console.warn('EMSC failed:', e.message); }
  if (base) {
    try { phiv = parsePhivolcsQuakes(await getJson(`${base}/api/phivolcs?days=14&min=${MIN}`)); }
    catch (e) { console.warn('PHIVOLCS failed:', e.message); }
  } else {
    console.warn('LINDOL_BASE not set: skipping PHIVOLCS (the perishable source). Set it to capture PHIVOLCS.');
  }
  // PHIVOLCS first so it wins on value, same precedence as the live app.
  const merged = mergeQuakes(mergeQuakes(phiv, usgs), emsc);
  merged.sort((a, b) => b.time - a.time);
  mkdirSync('src/features/quakes/snapshots', { recursive: true });
  writeFileSync('src/features/quakes/snapshots/sarangani-2026-06.json', JSON.stringify(merged, null, 2));
  console.log(`Wrote ${merged.length} quakes (PHIVOLCS ${phiv.length}, USGS ${usgs.length}, EMSC ${emsc.length}).`);
}
main();
```

- [ ] **Step 2: Run the capture**

Run (set the base to your deployed Vercel domain so PHIVOLCS is included):
```bash
LINDOL_BASE="https://<your-vercel-domain>" node scripts/capture-snapshot.mjs
```
Expected: prints `Wrote NNN quakes (PHIVOLCS .., USGS .., EMSC ..).` with PHIVOLCS count > 0 and a non-trivial total, and creates `src/features/quakes/snapshots/sarangani-2026-06.json`. If PHIVOLCS is 0, fix `LINDOL_BASE` and rerun before continuing (the perishable data is the whole point).

- [ ] **Step 3: Sanity-check the snapshot contains the M7.8**

Run:
```bash
node -e "const q=require('./src/features/quakes/snapshots/sarangani-2026-06.json'); const m=q.reduce((a,b)=>b.mag>a.mag?b:a); console.log(JSON.stringify(m,null,2)); console.log('total',q.length)"
```
Expected: the printed record has `mag` near 7.8. Copy this record's `id`, `time`, `lat`, `lng`, `depthKm`, `place`, `sources` for Task 2.

- [ ] **Step 4: Commit**

```bash
git add scripts/capture-snapshot.mjs src/features/quakes/snapshots/sarangani-2026-06.json
git commit -m "chore(quakes): capture week-1 Sarangani snapshot (preserve perishable PHIVOLCS data)"
```

---

## Task 2: Sequence definition + classifyQuakes (TDD)

**Files:**
- Create: `src/features/quakes/sequences.js`
- Test: `src/features/quakes/sequences.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/features/quakes/sequences.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { classifyQuakes } from './sequences.js';

// A tiny test sequence: mainshock at (6,125), aftershock radius 150 km, start at t=1000.
const SEQ = {
  id: 'test-seq',
  mainshock: { id: 'main', time: 1000, lat: 6, lng: 125, mag: 7.8 },
  center: [6, 125],
  radiusKm: 150,
  startTime: 1000,
};

describe('classifyQuakes', () => {
  it('picks the mainshock by anchor, not by largest magnitude in the feed', () => {
    const feed = [
      { id: 'main', time: 1000, lat: 6, lng: 125, mag: 7.8 },
      { id: 'huge-elsewhere', time: 2000, lat: 18, lng: 121, mag: 8.5 }, // bigger, far north
    ];
    const { mainshock, other } = classifyQuakes(feed, SEQ);
    expect(mainshock.id).toBe('main');
    expect(other.map((q) => q.id)).toContain('huge-elsewhere');
  });

  it('puts a far-away quake (Luzon) in other, never aftershocks', () => {
    const feed = [
      { id: 'main', time: 1000, lat: 6, lng: 125, mag: 7.8 },
      { id: 'luzon', time: 3000, lat: 16.5, lng: 120.5, mag: 5.0 },
    ];
    const { aftershocks, other } = classifyQuakes(feed, SEQ);
    expect(aftershocks.map((q) => q.id)).not.toContain('luzon');
    expect(other.map((q) => q.id)).toContain('luzon');
  });

  it('puts a nearby post-mainshock quake in aftershocks', () => {
    const feed = [
      { id: 'main', time: 1000, lat: 6, lng: 125, mag: 7.8 },
      { id: 'near-after', time: 5000, lat: 6.3, lng: 125.2, mag: 4.5 },
    ];
    const { aftershocks } = classifyQuakes(feed, SEQ);
    expect(aftershocks.map((q) => q.id)).toContain('near-after');
  });

  it('puts a nearby PRE-mainshock quake in other, not aftershocks', () => {
    const feed = [
      { id: 'main', time: 1000, lat: 6, lng: 125, mag: 7.8 },
      { id: 'near-before', time: 500, lat: 6.1, lng: 125.1, mag: 4.0 },
    ];
    const { aftershocks, other } = classifyQuakes(feed, SEQ);
    expect(aftershocks.map((q) => q.id)).not.toContain('near-before');
    expect(other.map((q) => q.id)).toContain('near-before');
  });

  it('falls back to the static anchor when the feed lacks the mainshock', () => {
    const feed = [{ id: 'luzon', time: 3000, lat: 16.5, lng: 120.5, mag: 5.0 }];
    const { mainshock, aftershocks } = classifyQuakes(feed, SEQ);
    expect(mainshock.id).toBe('main');
    expect(aftershocks).toEqual([]);
  });

  it('handles an empty feed', () => {
    const { mainshock, aftershocks, other } = classifyQuakes([], SEQ);
    expect(mainshock.id).toBe('main');
    expect(aftershocks).toEqual([]);
    expect(other).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/quakes/sequences.test.js`
Expected: FAIL with a module/import error (`classifyQuakes` is not exported / file missing).

- [ ] **Step 3: Write the implementation**

Create `src/features/quakes/sequences.js`. Fill `SARANGANI_SEQUENCE.mainshock` from the record you copied in Task 1 Step 3 (the `<...>` values):

```js
import { haversineKm } from '../../lib/geo.js';
import { sameQuake } from './quakeMerge.js';

// The M7.8 Sarangani / Southern Mindanao sequence, pinned so the app's headline event can
// never drop off the rolling window or be silently replaced by a later larger quake. Values
// are the authoritative mainshock record captured in the week-1 snapshot (Task 1).
export const SARANGANI_SEQUENCE = {
  id: 'sarangani-2026-06',
  name: 'Sarangani / Southern Mindanao sequence',
  mainshock: {
    id: '<id from snapshot>',
    time: <time ms from snapshot>,
    lat: <lat from snapshot>,
    lng: <lng from snapshot>,
    mag: 7.8,
    depthKm: <depthKm from snapshot>,
    place: '<place from snapshot>',
    source: 'phivolcs',
    sources: ['PHIVOLCS', 'USGS', 'EMSC'],
  },
  // A quake within radiusKm of the epicentre AND at/after the mainshock is a sequence aftershock.
  center: [<lat from snapshot>, <lng from snapshot>],
  radiusKm: 150,
  startTime: <time ms from snapshot>,
};

// Split a merged quake feed into the pinned mainshock, its genuine aftershocks (near in space,
// at/after the mainshock in time), and every other quake in the country. Pure and total.
export function classifyQuakes(quakes = [], sequence = SARANGANI_SEQUENCE) {
  const list = Array.isArray(quakes) ? quakes : [];
  const anchor = sequence.mainshock;
  let mainshock = null;
  const rest = [];
  for (const q of list) {
    if (!mainshock && (q.id === anchor.id || sameQuake(q, anchor))) mainshock = q;
    else rest.push(q);
  }
  if (!mainshock) mainshock = anchor;

  const aftershocks = [];
  const other = [];
  for (const q of rest) {
    const near = Number.isFinite(q.lat) && Number.isFinite(q.lng)
      && haversineKm(sequence.center, [q.lat, q.lng]) <= sequence.radiusKm;
    if (near && q.time >= sequence.startTime) aftershocks.push(q);
    else other.push(q);
  }
  return { mainshock, aftershocks, other };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/quakes/sequences.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/quakes/sequences.js src/features/quakes/sequences.test.js
git commit -m "feat(quakes): pin Sarangani mainshock + classify quakes into mainshock/aftershocks/other"
```

---

## Task 3: Wire useQuakes to inject the snapshot + anchor and return the 3-bucket shape

**Files:**
- Modify: `src/features/quakes/useQuakes.js`

- [ ] **Step 1: Add imports**

At the top of `src/features/quakes/useQuakes.js`, after the existing imports, add:

```js
import { SARANGANI_SEQUENCE, classifyQuakes } from './sequences.js';
import snapshot from './snapshots/sarangani-2026-06.json';
```

- [ ] **Step 2: Add `other` to the initial state**

Change the `useState` initialiser (line ~24-26) from:

```js
  const [state, setState] = useState({
    all: [], latest: null, mainshock: null, aftershocks: [], status: 'loading', updatedAt: null,
  });
```

to:

```js
  const [state, setState] = useState({
    all: [], latest: null, mainshock: null, aftershocks: [], other: [], status: 'loading', updatedAt: null,
  });
```

- [ ] **Step 3: Rewrite the `recommit` body to merge snapshot + anchor and classify**

Replace the body of `recommit` (the block that builds `merged`, `enriched`, `byMag`, `byTime` and calls `setState`) with:

```js
    function recommit(status, updatedAt) {
      if (cancelled) return;
      // PHIVOLCS first so it wins on duplicates; EMSC WebSocket pushes merged last (instant).
      const live = mergeQuakes(
        mergeQuakes(mergeQuakes(phivRef.current, usgsRef.current), emscRef.current),
        wsRef.current,
      );
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
        mainshock,
        aftershocks,
        other,
        status: enriched.length ? (status ?? s.status) : 'empty',
        updatedAt: updatedAt ?? s.updatedAt,
      }));
    }
```

- [ ] **Step 4: Run the full suite to confirm nothing regressed**

Run: `npx vitest run`
Expected: PASS (existing tests, including `quakeMerge.test.js` and the new `sequences.test.js`).

- [ ] **Step 5: Commit**

```bash
git add src/features/quakes/useQuakes.js
git commit -m "feat(quakes): merge week-1 snapshot + pinned anchor, expose other bucket"
```

---

## Task 4: Widen the live window and fix the day-count copy

**Files:**
- Modify: `src/config.js`

- [ ] **Step 1: Widen the window**

In `src/config.js`, change:

```js
  windowDays: 7,
```

to:

```js
  // The anchor + snapshot guarantee the sequence survives; the live window just keeps recent
  // activity rich. ~30 days comfortably covers the active sequence.
  windowDays: 30,
```

- [ ] **Step 2: Build to confirm the config still loads**

Run: `npm run build`
Expected: build succeeds (the copy that hardcodes "7 days" is fixed in Task 6).

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "feat(quakes): widen live window to 30 days (sequence guaranteed by anchor)"
```

---

## Task 5: Render the `other` bucket on the map with neutral labels

**Files:**
- Modify: `src/features/quakes/QuakeMap.jsx`

- [ ] **Step 1: Accept the `other` prop**

In the `QuakeMap` signature (line ~155-158), change:

```js
export default function QuakeMap({
  mainshock, aftershocks = [], reports = [], user = REGION.defaultUser,
  fill = false, dark = false, onReportAt, focus, zone = null,
}) {
```

to:

```js
export default function QuakeMap({
  mainshock, aftershocks = [], other = [], reports = [], user = REGION.defaultUser,
  fill = false, dark = false, onReportAt, focus, zone = null,
}) {
```

- [ ] **Step 2: Render the neutral `other` layer**

Find the estimated felt-area block (the one rendering `aftershocks.filter((q) => q.mag >= 4.5)` as `Circle`s, around line 434-437). Immediately AFTER that block, add the `other` layer:

```jsx
        {/* Other PH quakes outside the Sarangani sequence: shown with neutral labels (never
            called "aftershock"), distinguished by a dashed outline. Live only. */}
        {live && showQuakes && other.map((q) => (
          <CircleMarker key={`other-${q.id}`} center={[q.lat, q.lng]} radius={dotRadius(q.mag, zoom)}
            eventHandlers={{ click: () => showFelt(q) }}
            pathOptions={{ color: 'rgba(18,14,10,0.55)', weight: 1, dashArray: '2 3',
              fillColor: magColor(q.mag), fillOpacity: 0.5 }}>
            <Popup>
              <div className="pin-pop">
                <span className="pp-mag">M{q.mag.toFixed(1)}</span> earthquake
                <div className="pp-sub">{q.place}<br />{relativeTime(q.time)}
                  {q.distanceKm != null ? ` · ≈ ${formatKm(q.distanceKm)} from you` : ''}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
```

(`CircleMarker`, `Popup`, `dotRadius`, `magColor`, `relativeTime`, `formatKm` are all already imported and used by `coreDots` in this file.)

- [ ] **Step 3: Build to confirm the component compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/features/quakes/QuakeMap.jsx
git commit -m "feat(map): render non-sequence PH quakes with neutral labels (not aftershocks)"
```

---

## Task 6: Wire `other` through App.jsx and reframe the copy

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Destructure `other` from useQuakes**

Change line ~69 from:

```js
  const { latest, mainshock, aftershocks, all, status, updatedAt } = useQuakes(user);
```

to:

```js
  const { latest, mainshock, aftershocks, other, all, status, updatedAt } = useQuakes(user);
```

- [ ] **Step 2: Pass `other` to both QuakeMap instances**

In the mobile map screen (line ~203) and the desktop pane (line ~333), add `other={other}` to each `<QuakeMap ... />`. The mobile one becomes:

```jsx
          <QuakeMap fill mainshock={mainshock} aftershocks={aftershocks} other={other} reports={reports} user={user} dark={theme === 'dark'} onReportAt={openReportAt} focus={mapFocus} zone={zone} />
```

Apply the identical `other={other}` addition to the desktop `<QuakeMap ... />` near line 333.

- [ ] **Step 3: Reframe the source note and day-count copy (national framing, no em dashes)**

Change the zone-stat sub copy (line ~222) from:

```jsx
                  <span className="zs-sub">M2.0+ · last 7 days · tap to view the zone on the map</span>
```

to:

```jsx
                  <span className="zs-sub">M2.0+ · last {REGION.windowDays} days · tap to view the zone on the map</span>
```

Change the section label (line ~227) from:

```jsx
              <SectionLabel>Recent quakes · {all.length} in 7 days</SectionLabel>
```

to:

```jsx
              <SectionLabel>Recent quakes · {all.length} in {REGION.windowDays} days</SectionLabel>
```

Change the source note (line ~228) from:

```jsx
              <p className="src-note">Showing <b>M2.0+</b> from <b>PHIVOLCS</b> (the local authority), with <b>USGS &amp; EMSC</b> as backup. PHIVOLCS records the small local aftershocks the global networks miss. Data can still lag a few minutes behind the actual quake, so if you feel shaking, don't wait - Drop, Cover, Hold On.</p>
```

to:

```jsx
              <p className="src-note">Showing <b>M2.0+</b> earthquakes across the Philippines from <b>PHIVOLCS</b> (the local authority), with <b>USGS &amp; EMSC</b> as backup. The active Sarangani sequence is highlighted on the map. Data can lag a few minutes behind the actual quake, so if you feel shaking, don't wait. Drop, Cover, Hold On.</p>
```

- [ ] **Step 4: Run build and full suite**

Run: `npm run build && npx vitest run`
Expected: build succeeds, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(home): national framing copy + pass other-quakes bucket to the map"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full build + test**

Run: `npm run build && npx vitest run`
Expected: build succeeds, all tests green.

- [ ] **Step 2: Manual smoke check**

Run: `npm run dev`, open the app, and confirm:
- Home still shows the M7.8 as the latest/headline event and the "Recent quakes" list populates.
- On the map, sequence aftershocks near Sarangani still read "M.. aftershock" in their popup, while a quake far away (e.g. Luzon/Visayas, if present in the feed) reads "M.. earthquake" with a dashed outline.
- The Sarangani aftershock-zone polygon still draws and the zone count still shows.

- [ ] **Step 3: Confirm the mainshock survives an empty live feed (the core guarantee)**

Temporarily make the live loaders no-op is unnecessary; instead trust the `sequences.test.js` "falls back to the static anchor" and "empty feed" cases, already green. Note this in the PR description rather than hand-testing offline.

---

## Self-review notes

- **Spec coverage:** static anchor (Task 2), week-1 snapshot (Task 1), 3-bucket classification (Task 2 + 3), window pin (Task 4), neutral `other` labels + national copy (Tasks 5-6). All spec sections map to a task.
- **Deferred (per spec non-goals):** Supabase `quake_history` table, USGS historical backfill, timeline UI, trench overlay. Not in this plan.
- **Type consistency:** the 3-bucket return `{ mainshock, aftershocks, other }` is defined in Task 2 and consumed identically in Tasks 3, 5, 6. The quake shape is unchanged. `REGION.windowDays` (Task 4) is the single source for the day-count copy (Task 6).
