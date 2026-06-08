# LINDÓL — Phase 2: Citizen Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn on real citizen reporting — anonymous, GPS-tagged, camera-only photo reports that appear live on the map and feed, with a sensitivity gate, community flag-to-hide moderation, an offline submit queue, and an authenticated admin takedown page.

**Architecture:** Add a `reports` feature module backed by **Supabase** (Postgres + Storage + Realtime + Auth). The anonymous web client inserts reports directly via RLS-protected policies; flagging goes through a `SECURITY DEFINER` RPC so anon users can't tamper with rows. Photos are downscaled client-side and uploaded to a public Storage bucket. Offline submissions are queued in IndexedDB and flushed on reconnect. The admin page is a hash-routed (`#admin`) view gated by Supabase Auth. Pure logic (validation, normalization, queue, device id, image guard) is unit-tested; Supabase calls are mocked in tests and exercised live during verification.

**Tech Stack:** Existing Vite + React + Leaflet + vite-plugin-pwa, plus `@supabase/supabase-js` and `idb-keyval` (tiny IndexedDB wrapper for the offline queue).

**Builds on Phase 1:** reuses `src/lib/geo.js` (`haversineKm`, `formatKm`), `src/lib/time.js` (`relativeTime`, `formatClock`), `src/config.js` (`REGION`), `src/lib/useOnline.js`, the app shell, and `QuakeMap`. Replaces `ReportButtonStub`.

**Design source of truth (CSS + markup):** `prototype/index.html` already contains every report/sheet/feed/photo/toast/chip style and the capture-flow markup. Phase 1 intentionally skipped these blocks; Phase 2 ports them.

---

## Decisions locked in (from the spec)
- **Anonymous posting**, no sign-up. The Supabase **anon key is public by design** (shipped in the client); RLS protects the data.
- **Categories** (match the prototype keys/colors): `damage` #9A5B16 · `road` #C08A1E · `fire` #E0521B · `help` #CC2A2A · `safe` #3F7D43 · `other` #8A8175.
- **Photos only** (no video). Downscaled to ≤1280px JPEG before upload.
- **Moderation:** text+location post instantly; photos show behind a blur gate; any user can flag; **auto-hidden at 3 flags**; admin can hide/restore/delete.
- **Distance** is computed **client-side** with `haversineKm` (report volume is modest — no PostGIS needed for v1).
- **Admin** = Supabase Auth email/password, single admin account, at `#admin`.

## Normalized `Report` shape (used across the feature)
```js
// Returned by normalizeRow(); consumed by map, feed, admin.
{ id, createdAt /* epoch ms */, category, note, lat, lng, photoUrl /* string|null */, status /* 'visible'|'hidden' */, flagCount }
// useReports adds: distanceKm
```

## DB row (Supabase `public.reports`)
`id uuid pk` · `created_at timestamptz` · `category text` · `note text` · `lat float8` · `lng float8` · `photo_url text null` · `status text default 'visible'` · `flag_count int default 0`

---

## File Structure

```
.env.local                          (gitignored; VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
.env.example                        (documents the two vars)
supabase/schema.sql                 (table + RLS + flag_report RPC + bucket policy — run in Supabase SQL editor)
src/lib/supabase.js                 (createClient singleton from env)
src/lib/device.js (+test)           (getDeviceId: persistent uuid in localStorage)
src/lib/image.js                    (compressImage: canvas downscale to jpeg; rejectFile guard) (+test for guard)
src/features/reports/
  reportSchema.js (+test)           (CATEGORIES, categoryColor, validateReport)
  reportsApi.js (+test)             (normalizeRow, fetchRecentReports, uploadPhoto, insertReport, flagReport)
  reportQueue.js (+test)            (enqueue/list/remove/flush — IndexedDB via idb-keyval, store injectable)
  useReports.js                     (hook: fetch + realtime subscribe + distance enrich + queue flush on reconnect)
  reportMarkers.js                  (leaflet divIcon per category)
  ReportButton.jsx                  (the FAB; opens the sheet)
  ReportSheet.jsx                   (capture flow: GPS → category → note → camera → submit)
  ReportFeed.jsx                    (Near you list)
  ReportCard.jsx                    (one report; sensitivity-gated photo + flag)
src/components/SensitivePhoto.jsx   (blur "tap to reveal" gate)
src/features/admin/
  adminApi.js                       (signIn/out, fetchModerationQueue, hideReport, restoreReport, deleteReport)
  AdminPage.jsx                     (login form + moderation queue)
```
Modified: `src/App.jsx`, `src/features/quakes/QuakeMap.jsx` (render report pins + layer toggles), `src/styles/global.css` (port report/sheet/feed/photo/toast/chip CSS), `vite.config.js` (Supabase runtime caching), `package.json` (deps), `.gitignore` (.env.local).

---

## Task 0: Provision Supabase (setup — run once, mostly manual)

**Files:** Create `supabase/schema.sql`, `.env.example`; create `.env.local` (gitignored).

This task stands up the backend. The implementer writes the SQL/env files; the **human operator** runs the SQL and provides credentials (the controller will pause here for the operator).

- [ ] **Step 1: Write `supabase/schema.sql`**

```sql
-- LINDÓL reports schema. Run in Supabase SQL editor.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('damage','road','fire','help','safe','other')),
  note text not null default '' check (char_length(note) <= 280),
  lat float8 not null,
  lng float8 not null,
  photo_url text,
  status text not null default 'visible' check (status in ('visible','hidden')),
  flag_count int not null default 0
);
create index if not exists reports_created_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

-- Anyone (anon) can read visible reports.
create policy "read visible" on public.reports
  for select to anon using (status = 'visible');
-- Authenticated admin can read everything (incl. hidden / flagged).
create policy "admin read all" on public.reports
  for select to authenticated using (true);
-- Anyone can insert, but only as a clean visible row (no presetting status/flags).
create policy "public insert" on public.reports
  for insert to anon with check (status = 'visible' and flag_count = 0);
-- Only authenticated admin can update/delete directly.
create policy "admin update" on public.reports
  for update to authenticated using (true) with check (true);
create policy "admin delete" on public.reports
  for delete to authenticated using (true);

-- Flagging via SECURITY DEFINER so anon can't broadly UPDATE rows.
create or replace function public.flag_report(rid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.reports
     set flag_count = flag_count + 1,
         status = case when flag_count + 1 >= 3 then 'hidden' else status end
   where id = rid and status = 'visible';
end; $$;
grant execute on function public.flag_report(uuid) to anon, authenticated;

-- Realtime for live map updates.
alter publication supabase_realtime add table public.reports;
```

- [ ] **Step 2: Write `.env.example`**
```bash
# Supabase project credentials (Project Settings → API). The anon key is public/safe.
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 3: Add `.env.local` to `.gitignore`**
Append `.env.local` and `.env` to `.gitignore` (keep existing entries).

- [ ] **Step 4: OPERATOR — provision the project** (controller pauses here)
1. Create a free project at supabase.com (note the project URL + anon key under Project Settings → API).
2. SQL Editor → paste & run `supabase/schema.sql`.
3. Storage → create a **public** bucket named `report-photos`.
4. Storage → bucket policies: allow `insert` (upload) to `anon`, `select` (read) to `public`. (Supabase UI: "Allow anonymous uploads" / add policy `bucket_id = 'report-photos'` for `anon insert` and `public select`.)
5. Authentication → Users → "Add user" → create the single **admin** email + password. (Disable public sign-ups under Auth settings.)
6. Create `.env.local` at repo root with the real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
7. Add the same two vars in **Vercel → project → Settings → Environment Variables** (Production + Preview).

- [ ] **Step 5: Commit** (only the non-secret files)
```bash
git add supabase/schema.sql .env.example .gitignore
git commit -m "feat(reports): add supabase schema, RLS, flag RPC, env template"
```

---

## Task 1: Install deps + Supabase client

**Files:** Create `src/lib/supabase.js`; modify `package.json`.

- [ ] **Step 1: Install**
```bash
npm install @supabase/supabase-js idb-keyval
```

- [ ] **Step 2: Create `src/lib/supabase.js`**
```js
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Single shared client. `configured` lets the UI degrade gracefully if env is missing.
export const supabaseConfigured = Boolean(url && anonKey);
export const supabase = supabaseConfigured ? createClient(url, anonKey) : null;
```

- [ ] **Step 3: Verify build**
Run: `npm run build`
Expected: success (env may be absent in CI — `supabase` is then null; that's intended).

- [ ] **Step 4: Commit**
```bash
git add package.json package-lock.json src/lib/supabase.js
git commit -m "feat(reports): add supabase + idb-keyval deps and client"
```

---

## Task 2: `lib/device.js` — persistent device id (TDD)

**Files:** Create `src/lib/device.js`, `src/lib/device.test.js`.

- [ ] **Step 1: Failing test**
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { getDeviceId } from './device.js';

beforeEach(() => localStorage.clear());

describe('getDeviceId', () => {
  it('returns a stable id across calls', () => {
    const a = getDeviceId();
    const b = getDeviceId();
    expect(a).toBe(b);
    expect(a).toMatch(/[0-9a-f-]{20,}/i);
  });
});
```

- [ ] **Step 2: Run, expect fail** — `npm test` → not defined.

- [ ] **Step 3: Implement `src/lib/device.js`**
```js
const KEY = 'lindol:device-id';

// A stable anonymous id per device, used for client-side rate limiting/dedup.
export function getDeviceId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(KEY, id);
  }
  return id;
}
```

- [ ] **Step 4: Run, expect pass.** **Step 5: Commit** `feat(reports): add stable device id helper`.

---

## Task 3: `reports/reportSchema.js` — categories + validation (TDD)

**Files:** Create `src/features/reports/reportSchema.js`, `reportSchema.test.js`.

- [ ] **Step 1: Failing test**
```js
import { describe, it, expect } from 'vitest';
import { CATEGORIES, categoryColor, validateReport } from './reportSchema.js';

describe('CATEGORIES', () => {
  it('has the six categories with keys + colors', () => {
    expect(CATEGORIES.map((c) => c.key)).toEqual(['damage','road','fire','help','safe','other']);
    expect(categoryColor('fire')).toBe('#E0521B');
    expect(categoryColor('nope')).toBe('#8A8175'); // falls back to "other"
  });
});

describe('validateReport', () => {
  const base = { category: 'damage', note: '', lat: 7.0, lng: 126.0 };
  it('accepts a valid report', () => {
    expect(validateReport(base)).toEqual({ valid: true, errors: [] });
  });
  it('rejects an unknown category', () => {
    expect(validateReport({ ...base, category: 'x' }).valid).toBe(false);
  });
  it('rejects missing coordinates', () => {
    expect(validateReport({ ...base, lat: null }).valid).toBe(false);
  });
  it('rejects an over-long note', () => {
    expect(validateReport({ ...base, note: 'x'.repeat(281) }).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `src/features/reports/reportSchema.js`**
```js
export const CATEGORIES = [
  { key: 'damage', label: 'Damage',      color: '#9A5B16' },
  { key: 'road',   label: 'Blocked road', color: '#C08A1E' },
  { key: 'fire',   label: 'Fire',        color: '#E0521B' },
  { key: 'help',   label: 'Need help',   color: '#CC2A2A' },
  { key: 'safe',   label: 'Safe here',   color: '#3F7D43' },
  { key: 'other',  label: 'Other',       color: '#8A8175' },
];

const BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export function categoryColor(key) {
  return (BY_KEY[key] ?? BY_KEY.other).color;
}

// Returns { valid, errors[] }. Note optional, max 280 chars. Coords required numbers.
export function validateReport({ category, note = '', lat, lng }) {
  const errors = [];
  if (!BY_KEY[category]) errors.push('category');
  if (typeof lat !== 'number' || Number.isNaN(lat)) errors.push('lat');
  if (typeof lng !== 'number' || Number.isNaN(lng)) errors.push('lng');
  if (typeof note !== 'string' || note.length > 280) errors.push('note');
  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run, expect pass.** **Step 5: Commit** `feat(reports): add category + report validation`.

---

## Task 4: `lib/image.js` — client-side photo downscale + guard

**Files:** Create `src/lib/image.js`, `src/lib/image.test.js`.

- [ ] **Step 1: Failing test** (test the pure guard; the canvas resize is build/manual-verified)
```js
import { describe, it, expect } from 'vitest';
import { rejectFile } from './image.js';

describe('rejectFile', () => {
  it('accepts a normal-sized image', () => {
    expect(rejectFile({ type: 'image/jpeg', size: 2_000_000 })).toBeNull();
  });
  it('rejects non-images', () => {
    expect(rejectFile({ type: 'application/pdf', size: 1000 })).toMatch(/image/i);
  });
  it('rejects oversized files (>20MB pre-compression)', () => {
    expect(rejectFile({ type: 'image/jpeg', size: 25_000_000 })).toMatch(/too large/i);
  });
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `src/lib/image.js`**
```js
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_DIM = 1280;
const QUALITY = 0.7;

// Returns an error string if the file is unusable, else null.
export function rejectFile(file) {
  if (!file || !String(file.type).startsWith('image/')) return 'Please use a photo (image) file.';
  if (file.size > MAX_BYTES) return 'That photo is too large.';
  return null;
}

// Downscale to <= MAX_DIM and re-encode as JPEG Blob. Falls back to the original file on failure.
export async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', QUALITY));
    return blob ?? file;
  } catch {
    return file;
  }
}
```

- [ ] **Step 4: Run, expect pass.** **Step 5: Commit** `feat(reports): add image compression + file guard`.

---

## Task 5: `reports/reportsApi.js` — normalize + CRUD (TDD pure parts, mock the client)

**Files:** Create `src/features/reports/reportsApi.js`, `reportsApi.test.js`.

- [ ] **Step 1: Failing test**
```js
import { describe, it, expect, vi } from 'vitest';
import { normalizeRow, fetchRecentReports, flagReport } from './reportsApi.js';

describe('normalizeRow', () => {
  it('maps a db row to the Report shape', () => {
    const row = { id: 'a', created_at: '2026-06-08T07:42:00Z', category: 'fire',
      note: 'hi', lat: 7, lng: 126, photo_url: 'u', status: 'visible', flag_count: 2 };
    expect(normalizeRow(row)).toEqual({
      id: 'a', createdAt: Date.parse('2026-06-08T07:42:00Z'), category: 'fire',
      note: 'hi', lat: 7, lng: 126, photoUrl: 'u', status: 'visible', flagCount: 2,
    });
  });
});

describe('fetchRecentReports', () => {
  it('queries reports and returns normalized rows', async () => {
    const rows = [{ id: 'a', created_at: '2026-06-08T07:42:00Z', category: 'fire',
      note: '', lat: 7, lng: 126, photo_url: null, status: 'visible', flag_count: 0 }];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const gte = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ gte }));
    const client = { from: vi.fn(() => ({ select })) };
    const out = await fetchRecentReports(client);
    expect(client.from).toHaveBeenCalledWith('reports');
    expect(out[0].id).toBe('a');
  });
});

describe('flagReport', () => {
  it('calls the flag_report rpc', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await flagReport({ rpc }, 'rid-1');
    expect(rpc).toHaveBeenCalledWith('flag_report', { rid: 'rid-1' });
  });
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `src/features/reports/reportsApi.js`**
```js
import { compressImage } from '../../lib/image.js';

export function normalizeRow(r) {
  return {
    id: r.id,
    createdAt: Date.parse(r.created_at),
    category: r.category,
    note: r.note ?? '',
    lat: r.lat,
    lng: r.lng,
    photoUrl: r.photo_url ?? null,
    status: r.status,
    flagCount: r.flag_count ?? 0,
  };
}

// Visible reports from the last `sinceHours`, newest first.
export async function fetchRecentReports(client, { sinceHours = 48, limit = 200 } = {}) {
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const { data, error } = await client
    .from('reports')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).slice(0, limit).map(normalizeRow);
}

// Upload a (already-compressed) blob; returns its public URL.
export async function uploadPhoto(client, blob, id) {
  const path = `${id}.jpg`;
  const { error } = await client.storage.from('report-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return client.storage.from('report-photos').getPublicUrl(path).data.publicUrl;
}

// Insert a report (optionally with a photo File/Blob). Returns the normalized row.
export async function insertReport(client, { id, category, note, lat, lng, photoFile }) {
  let photo_url = null;
  if (photoFile) {
    const blob = await compressImage(photoFile);
    photo_url = await uploadPhoto(client, blob, id);
  }
  const { data, error } = await client
    .from('reports')
    .insert({ id, category, note, lat, lng, photo_url })
    .select()
    .single();
  if (error) throw error;
  return normalizeRow(data);
}

export async function flagReport(client, rid) {
  const { error } = await client.rpc('flag_report', { rid });
  if (error) throw error;
}
```
(`id` is generated client-side with `crypto.randomUUID()` so the photo path and row share it and the report can be queued offline before insert.)

- [ ] **Step 4: Run, expect pass.** **Step 5: Commit** `feat(reports): add reports API (fetch/insert/upload/flag)`.

---

## Task 6: `reports/reportQueue.js` — offline submit queue (TDD with injected store)

**Files:** Create `src/features/reports/reportQueue.js`, `reportQueue.test.js`.

- [ ] **Step 1: Failing test** (inject an in-memory store so no real IndexedDB needed)
```js
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
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `src/features/reports/reportQueue.js`**
```js
import { get, set } from 'idb-keyval';

const KEY = 'lindol:report-queue';

// Default store backs onto IndexedDB; tests inject an in-memory store.
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
    // submit(report) should throw on failure. Returns count submitted.
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
```

- [ ] **Step 4: Run, expect pass.** **Step 5: Commit** `feat(reports): add offline IndexedDB submit queue`.

---

## Task 7: `reports/useReports.js` — data hook (fetch + realtime + queue flush)

**Files:** Create `src/features/reports/useReports.js`. (Hook — verified via build + manual.)

- [ ] **Step 1: Implement**
```js
import { useEffect, useState, useCallback } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase.js';
import { fetchRecentReports, insertReport, normalizeRow } from './reportsApi.js';
import { reportQueue } from './reportQueue.js';
import { haversineKm } from '../../lib/geo.js';
import { REGION } from '../../config.js';

const enrich = (rows, user) =>
  rows.map((r) => ({ ...r, distanceKm: haversineKm(user, [r.lat, r.lng]) }));

// { reports, pendingCount, status, submit, flag, refresh }
export function useReports(user = REGION.defaultUser) {
  const [reports, setReports] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState(supabaseConfigured ? 'loading' : 'disabled');

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) return;
    try {
      const rows = await fetchRecentReports(supabase);
      setReports(enrich(rows, user));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [user[0], user[1]]);

  const syncQueue = useCallback(async () => {
    if (!supabaseConfigured) return;
    await reportQueue.flush((r) => insertReport(supabase, r));
    setPendingCount((await reportQueue.list()).length);
  }, []);

  useEffect(() => {
    refresh();
    syncQueue();
    reportQueue.list().then((q) => setPendingCount(q.length));
    if (!supabaseConfigured) return;
    const onLine = () => syncQueue().then(refresh);
    window.addEventListener('online', onLine);
    const channel = supabase
      .channel('reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => refresh())
      .subscribe();
    return () => {
      window.removeEventListener('online', onLine);
      supabase.removeChannel(channel);
    };
  }, [refresh, syncQueue]);

  // Optimistic submit: try now; on failure queue for later.
  const submit = useCallback(async (report) => {
    try {
      const saved = await insertReport(supabase, report);
      setReports((prev) => enrich([saved, ...prev.filter((r) => r.id !== saved.id)], user));
      return { ok: true, queued: false };
    } catch {
      await reportQueue.enqueue(report);
      setPendingCount((await reportQueue.list()).length);
      return { ok: true, queued: true };
    }
  }, [user[0], user[1]]);

  const flag = useCallback(async (id) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, flagCount: r.flagCount + 1 } : r)));
    const { flagReport } = await import('./reportsApi.js');
    try { await flagReport(supabase, id); } finally { refresh(); }
  }, [refresh]);

  return { reports, pendingCount, status, submit, flag, refresh };
}
```

- [ ] **Step 2: Build** `npm run build` → success. **Step 3: Commit** `feat(reports): add useReports hook with realtime + queue`.

---

## Task 8: Port report/sheet/feed CSS from the prototype

**Files:** Modify `src/styles/global.css`.

- [ ] **Step 1: Append the Phase-2 CSS blocks** — port VERBATIM from `prototype/index.html` `<style>`: `.maptools`, `.chip`, `.chip .sw`, `.chip.on`, `.rpin`, `.rpin b`, `.feed`, `.report`, `@keyframes rise` (if not already present — it is, from Phase 1; do not duplicate), `.rp-head`, `.cat-tag`, `.rp-dist`, `.rp-body`, `.photo`, `.photo .gate`, `.photo .gate small`, `.photo.revealed .gate`, `.rp-foot`, `.flagbtn`, `.flagbtn:hover`, `.report.hidden-rp`, `.report.hidden-rp .veil`, `.scrim`, `.scrim.open`, `.sheet`, `.scrim.open .sheet`, `.grab`, `.sheet h3`, `.sheet .step-sub`, `.gps`, `.catgrid`, `.catopt`, `.catopt .dot`, `.catopt.sel`, `textarea`, `textarea:focus`, `.camera`, `.camera:hover`, `.camera.shot`, `.camera .badge`, `.cam-hint`, `.submit`, `.submit:hover`, `.submit:disabled`, `.toast`, `.toast.show`, `.toast .tdot`.

- [ ] **Step 2: Build** `npm run build` → success. **Step 3: Commit** `feat(reports): port report/sheet/feed/toast styles`.

---

## Task 9: `SensitivePhoto`, `ReportCard`, `ReportFeed`

**Files:** Create `src/components/SensitivePhoto.jsx`, `src/features/reports/ReportCard.jsx`, `src/features/reports/ReportFeed.jsx`.

- [ ] **Step 1: `src/components/SensitivePhoto.jsx`**
```jsx
import { useState } from 'react';

export default function SensitivePhoto({ url }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className={`photo${revealed ? ' revealed' : ''}`}
      style={{ backgroundImage: `url('${url}')` }}
      onClick={() => setRevealed(true)}>
      <div className="gate">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
        </svg>
        <span>Sensitive content</span><small>Tap to view · may be distressing</small>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/features/reports/ReportCard.jsx`**
```jsx
import { categoryColor, CATEGORIES } from './reportSchema.js';
import { formatKm } from '../../lib/geo.js';
import { relativeTime } from '../../lib/time.js';
import SensitivePhoto from '../../components/SensitivePhoto.jsx';

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

export default function ReportCard({ report, onFlag }) {
  const color = categoryColor(report.category);
  return (
    <div className="report">
      <div className="rp-head">
        <span className="cat-tag" style={{ background: color }}>{LABEL[report.category] ?? 'Other'}</span>
        <span className="rp-dist">{formatKm(report.distanceKm ?? 0)} · {relativeTime(report.createdAt)}</span>
      </div>
      {report.photoUrl && <SensitivePhoto url={report.photoUrl} />}
      {report.note && <div className="rp-body">{report.note}</div>}
      <div className="rp-foot">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>
          {report.lat.toFixed(3)}, {report.lng.toFixed(3)}
        </span>
        <button className="flagbtn" onClick={() => onFlag(report.id)}>
          ⚑ Flag{report.flagCount ? ` · ${report.flagCount}` : ''}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/features/reports/ReportFeed.jsx`**
```jsx
import ReportCard from './ReportCard.jsx';

export default function ReportFeed({ reports, onFlag }) {
  if (!reports.length) {
    return <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No reports yet. Be the first to report what you see.</p>;
  }
  const sorted = [...reports].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  return (
    <div className="feed">
      {sorted.map((r) => <ReportCard key={r.id} report={r} onFlag={onFlag} />)}
    </div>
  );
}
```

- [ ] **Step 4: Build** → success. **Step 5: Commit** `feat(reports): add report feed + card + sensitivity gate`.

---

## Task 10: `ReportButton` + `ReportSheet` (capture flow)

**Files:** Create `src/features/reports/ReportButton.jsx`, `ReportSheet.jsx`.

- [ ] **Step 1: `src/features/reports/ReportButton.jsx`**
```jsx
export default function ReportButton({ onClick }) {
  return (
    <div className="fab">
      <button onClick={onClick}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M12 8v8M8 12h8" /><circle cx="12" cy="12" r="9" />
        </svg>
        Report what you see
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `src/features/reports/ReportSheet.jsx`**
```jsx
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES } from './reportSchema.js';
import { rejectFile } from '../../lib/image.js';
import { getDeviceId } from '../../lib/device.js';

const newId = () => crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// onSubmit(report) -> Promise<{ok, queued}>. report: {id, category, note, lat, lng, photoFile, deviceId}
export default function ReportSheet({ open, onClose, onSubmit, onToast }) {
  const [cat, setCat] = useState(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);     // File
  const [photoUrl, setPhotoUrl] = useState(''); // preview object URL
  const [coords, setCoords] = useState(null);   // [lat,lng]
  const [geoState, setGeoState] = useState('idle'); // idle|locating|ok|denied
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setGeoState('locating');
    navigator.geolocation?.getCurrentPosition(
      (p) => { setCoords([p.coords.latitude, p.coords.longitude]); setGeoState('ok'); },
      () => setGeoState('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [open]);

  function reset() {
    setCat(null); setNote(''); setPhoto(null);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(''); setBusy(false);
  }
  function close() { reset(); onClose(); }

  function onPickPhoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = rejectFile(f);
    if (err) { onToast(err, '#CC2A2A'); return; }
    setPhoto(f);
    setPhotoUrl(URL.createObjectURL(f));
  }

  async function submit() {
    if (!cat || !coords) return;
    setBusy(true);
    const res = await onSubmit({
      id: newId(), category: cat, note: note.trim(), lat: coords[0], lng: coords[1],
      photoFile: photo, deviceId: getDeviceId(),
    });
    onToast(res.queued ? 'No signal — report queued, will send when back online' : 'Report posted to the live map',
      res.queued ? '#C08A1E' : '#3F7D43');
    close();
  }

  const canSubmit = cat && coords && !busy;

  return (
    <div className={`scrim${open ? ' open' : ''}`} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet">
        <div className="grab" />
        <h3>Report from your location</h3>
        <div className="step-sub">Your report appears on the live map. Photos are taken in-app to keep them real.</div>

        <div className="gps">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
          </svg>
          <span>
            {geoState === 'locating' && 'Locating you…'}
            {geoState === 'ok' && coords && `GPS locked · ${coords[0].toFixed(3)}°, ${coords[1].toFixed(3)}°`}
            {geoState === 'denied' && 'Location needed to report — enable GPS and reopen.'}
          </span>
        </div>

        <div className="catgrid">
          {CATEGORIES.map((c) => (
            <div key={c.key} className={`catopt${cat === c.key ? ' sel' : ''}`} onClick={() => setCat(c.key)}>
              <span className="dot" style={{ background: c.color }} />{c.label}
            </div>
          ))}
        </div>

        <textarea rows="2" placeholder="Add a short note (optional)…" value={note}
          maxLength={280} onChange={(e) => setNote(e.target.value)} />

        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={onPickPhoto} />
        <div className={`camera${photoUrl ? ' shot' : ''}`}
          style={photoUrl ? { backgroundImage: `url('${photoUrl}')` } : undefined}
          onClick={() => fileRef.current?.click()}>
          {photoUrl ? <div className="badge">📷 captured · in-app</div> : (
            <>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>Tap to take a photo</span>
            </>
          )}
        </div>
        <div className="cam-hint">Camera only · no gallery uploads — keeps reports trustworthy</div>

        <button className="submit" disabled={!canSubmit} onClick={submit}>
          {!cat ? 'Choose a category to continue' : !coords ? 'Waiting for location…' : busy ? 'Posting…' : 'Post report to the map'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build** → success. **Step 4: Commit** `feat(reports): add report button + capture sheet`.

---

## Task 11: Report markers on the map

**Files:** Create `src/features/reports/reportMarkers.js`; modify `src/features/quakes/QuakeMap.jsx`.

- [ ] **Step 1: `src/features/reports/reportMarkers.js`**
```js
import L from 'leaflet';
import { categoryColor } from './reportSchema.js';

const ICON = { damage: '!', road: '=', fire: '~', help: '+', safe: '✓', other: '·' };

export function reportIcon(category) {
  const color = categoryColor(category);
  return L.divIcon({
    className: '', iconSize: [22, 22], iconAnchor: [11, 20],
    html: `<div class="rpin" style="background:${color}"><b>${ICON[category] ?? '·'}</b></div>`,
  });
}
```

- [ ] **Step 2: Extend `src/features/quakes/QuakeMap.jsx`** to accept `reports` and render them with a layer toggle. Add these imports + props and render block (keep existing quake rendering):
```jsx
import { useState } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { REGION } from '../../config.js';
import { reportIcon } from '../reports/reportMarkers.js';

const epiIcon = L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10],
  html: '<div class="epi"><div class="ring"></div><div class="core"></div></div>' });
const afterIcon = L.divIcon({ className: '', iconSize: [11, 11], iconAnchor: [5, 5],
  html: '<div class="after"></div>' });

export default function QuakeMap({ mainshock, aftershocks = [], reports = [], user = REGION.defaultUser }) {
  const [showQuakes, setShowQuakes] = useState(true);
  const [showReports, setShowReports] = useState(true);
  return (
    <div className="mapwrap">
      <div className="maptools">
        <div className={`chip${showQuakes ? ' on' : ''}`} onClick={() => setShowQuakes((v) => !v)}>
          <span className="sw" style={{ background: 'var(--ember)' }} />Quakes
        </div>
        <div className={`chip${showReports ? ' on' : ''}`} onClick={() => setShowReports((v) => !v)}>
          <span className="sw" style={{ background: 'var(--c-help)' }} />Reports
        </div>
      </div>
      <MapContainer center={REGION.center} zoom={9} zoomControl={false}
        attributionControl={false} style={{ height: 280, width: '100%' }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" maxZoom={19} />
        {showQuakes && mainshock && (
          <Marker position={[mainshock.lat, mainshock.lng]} icon={epiIcon}>
            <Popup><b>M{mainshock.mag.toFixed(1)}</b> · main shock</Popup>
          </Marker>
        )}
        {showQuakes && aftershocks.map((q) => (
          <Marker key={q.id} position={[q.lat, q.lng]} icon={afterIcon}>
            <Popup>Aftershock M{q.mag.toFixed(1)}</Popup>
          </Marker>
        ))}
        {showReports && reports.map((r) => (
          <Marker key={r.id} position={[r.lat, r.lng]} icon={reportIcon(r.category)}>
            <Popup>{r.note || r.category}</Popup>
          </Marker>
        ))}
        <CircleMarker center={user} radius={6}
          pathOptions={{ color: '#14110D', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
          <Popup>You are here</Popup>
        </CircleMarker>
      </MapContainer>
      <div className="legend">
        <span><i style={{ background: 'var(--ember)' }} />Epicenter</span>
        <span><i style={{ background: 'var(--c-damage)' }} />Damage</span>
        <span><i style={{ background: 'var(--c-road)' }} />Road</span>
        <span><i style={{ background: 'var(--c-fire)' }} />Fire</span>
        <span><i style={{ background: 'var(--c-help)' }} />Need help</span>
        <span><i style={{ background: 'var(--c-safe)' }} />Safe</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build** → success. **Step 4: Commit** `feat(reports): render report pins + layer toggles on map`.

---

## Task 12: Admin moderation page (`#admin`)

**Files:** Create `src/features/admin/adminApi.js`, `src/features/admin/AdminPage.jsx`.

- [ ] **Step 1: `src/features/admin/adminApi.js`**
```js
import { supabase } from '../../lib/supabase.js';
import { normalizeRow } from '../reports/reportsApi.js';

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() { await supabase.auth.signOut(); }
export async function getSession() {
  return (await supabase.auth.getSession()).data.session;
}
// Flagged or hidden reports, newest first (admin RLS sees all).
export async function fetchModerationQueue() {
  const { data, error } = await supabase.from('reports').select('*')
    .or('status.eq.hidden,flag_count.gt.0').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeRow);
}
export async function hideReport(id) {
  const { error } = await supabase.from('reports').update({ status: 'hidden' }).eq('id', id);
  if (error) throw error;
}
export async function restoreReport(id) {
  const { error } = await supabase.from('reports').update({ status: 'visible', flag_count: 0 }).eq('id', id);
  if (error) throw error;
}
export async function deleteReport(id) {
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2: `src/features/admin/AdminPage.jsx`**
```jsx
import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../../lib/supabase.js';
import { signIn, signOut, getSession, fetchModerationQueue, hideReport, restoreReport, deleteReport } from './adminApi.js';

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => { getSession().then(setSession); }, []);
  useEffect(() => { if (session) load(); }, [session]);

  async function load() { try { setRows(await fetchModerationQueue()); } catch (e) { setErr(String(e.message || e)); } }
  async function doLogin(e) {
    e.preventDefault(); setErr('');
    try { await signIn(email, pw); setSession(await getSession()); }
    catch (e2) { setErr('Login failed: ' + (e2.message || e2)); }
  }
  async function act(fn, id) { await fn(id); load(); }

  if (!supabaseConfigured) return <div style={{ padding: 24 }}>Reports backend not configured.</div>;

  if (!session) {
    return (
      <div style={{ maxWidth: 360, margin: '60px auto', padding: 24 }}>
        <h2 style={{ fontWeight: 800, marginBottom: 12 }}>LINDÓL admin</h2>
        <form onSubmit={doLogin}>
          <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: 12, marginBottom: 8 }} />
          <input type="password" placeholder="password" value={pw} onChange={(e) => setPw(e.target.value)}
            style={{ width: '100%', padding: 12, marginBottom: 8 }} />
          <button className="submit" type="submit">Sign in</button>
        </form>
        {err && <p style={{ color: '#CC2A2A', marginTop: 10 }}>{err}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '24px auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontWeight: 800 }}>Moderation queue</h2>
        <button className="flagbtn" onClick={() => signOut().then(() => setSession(null))}>Sign out</button>
      </div>
      {!rows.length && <p style={{ color: 'var(--ink-faint)' }}>Nothing flagged. 🎉</p>}
      {rows.map((r) => (
        <div className="report" key={r.id} style={{ marginBottom: 12 }}>
          <div className="rp-head">
            <span className="cat-tag" style={{ background: 'var(--ink)' }}>{r.category}</span>
            <span className="rp-dist">flags: {r.flagCount} · {r.status}</span>
          </div>
          {r.photoUrl && <div className="photo revealed" style={{ backgroundImage: `url('${r.photoUrl}')` }} />}
          {r.note && <div className="rp-body">{r.note}</div>}
          <div className="rp-foot" style={{ gap: 10 }}>
            {r.status !== 'hidden'
              ? <button className="flagbtn" onClick={() => act(hideReport, r.id)}>Hide</button>
              : <button className="flagbtn" onClick={() => act(restoreReport, r.id)}>Restore</button>}
            <button className="flagbtn" style={{ color: '#CC2A2A' }} onClick={() => act(deleteReport, r.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Build** → success. **Step 4: Commit** `feat(admin): add moderation queue page`.

---

## Task 13: Wire it all into `App.jsx` (+ hash route to admin)

**Files:** Modify `src/App.jsx`.

- [ ] **Step 1: Replace `App.jsx`**
```jsx
import { useState } from 'react';
import StatusBar from './components/StatusBar.jsx';
import Masthead from './components/Masthead.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import SectionLabel from './components/SectionLabel.jsx';
import ShareButton from './components/ShareButton.jsx';
import QuakeHero from './features/quakes/QuakeHero.jsx';
import QuakeMap from './features/quakes/QuakeMap.jsx';
import SafetyPanel from './features/safety/SafetyPanel.jsx';
import ReportButton from './features/reports/ReportButton.jsx';
import ReportSheet from './features/reports/ReportSheet.jsx';
import ReportFeed from './features/reports/ReportFeed.jsx';
import AdminPage from './features/admin/AdminPage.jsx';
import { useQuakes } from './features/quakes/useQuakes.js';
import { useReports } from './features/reports/useReports.js';
import { useOnline } from './lib/useOnline.js';

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, color) => { setToast({ msg, color }); setTimeout(() => setToast(null), 2600); };
  return [toast, show];
}

export default function App() {
  if (typeof window !== 'undefined' && window.location.hash === '#admin') return <AdminPage />;

  const online = useOnline();
  const { mainshock, aftershocks, all, status, updatedAt } = useQuakes();
  const { reports, pendingCount, submit, flag } = useReports();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, showToast] = useToast();

  return (
    <div className={`app${online ? '' : ' off'}`}>
      <StatusBar online={online} updatedAt={updatedAt} />
      <Masthead />
      <div className="scroll">
        {!online && <OfflineBanner updatedAt={updatedAt} />}
        {pendingCount > 0 && (
          <div className="offline-banner" style={{ display: 'flex' }}>
            <span>{pendingCount} report{pendingCount > 1 ? 's' : ''} queued — will send when you're back online.</span>
          </div>
        )}

        <section className="reveal">
          <SectionLabel>Latest event{status === 'cached' ? ' · cached' : ''}</SectionLabel>
          <QuakeHero quake={mainshock} />
        </section>

        <section className="reveal">
          <SectionLabel>Live map · {all.length} quakes · {reports.length} reports</SectionLabel>
          <QuakeMap mainshock={mainshock} aftershocks={aftershocks} reports={reports} />
        </section>

        <section className="reveal">
          <SectionLabel>Near you · newest first</SectionLabel>
          <ReportFeed reports={reports} onFlag={flag} />
        </section>

        <section className="reveal">
          <SectionLabel>Safety · works offline</SectionLabel>
          <SafetyPanel />
        </section>

        <section className="reveal">
          <SectionLabel>Help others stay safe</SectionLabel>
          <div className="share-cta">
            <p>Know someone in the area? Share LINDÓL so they get live earthquake info and safety guidance — even offline.</p>
            <ShareButton />
          </div>
        </section>
      </div>

      <ReportButton onClick={() => setSheetOpen(true)} />
      <ReportSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSubmit={submit} onToast={showToast} />
      {toast && (
        <div className="toast show">
          <span className="tdot" style={{ background: toast.color || '#3F7D43' }} />
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Delete the now-unused stub**
```bash
git rm src/components/ReportButtonStub.jsx
```

- [ ] **Step 3: Build + test** → `npm run build` and `npm test` pass. **Step 4: Commit** `feat(reports): wire reports + admin route into app shell`.

---

## Task 14: PWA caching for Supabase photos + reports

**Files:** Modify `vite.config.js`.

- [ ] **Step 1: Add two runtimeCaching rules** inside the existing `workbox.runtimeCaching` array (keep the USGS/tiles/fonts rules):
```js
          {
            // Report photos — cache-first so already-seen photos render offline.
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'report-photos', expiration: { maxEntries: 200, maxAgeSeconds: 604800 } },
          },
          {
            // Reports API — network-first so the feed shows last-known reports offline.
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'reports-api', expiration: { maxEntries: 20, maxAgeSeconds: 86400 } },
          },
```

- [ ] **Step 2: Build** → success; confirm precache + the new caches compile. **Step 3: Commit** `feat(reports): cache supabase photos + reports for offline`.

---

## Task 15: Full verification + deploy

- [ ] **Step 1: Unit suite** — `npm test` → all green (Phase 1 tests + new: device, reportSchema, image, reportsApi, reportQueue).
- [ ] **Step 2: Build** — `npm run build` → success.
- [ ] **Step 3: Local smoke test** (requires `.env.local` with real Supabase creds): `npm run dev`, then in a browser:
  - File a report (allow GPS; take/pick a photo) → it appears on the map + feed; a row lands in Supabase `reports`; the photo is in the `report-photos` bucket.
  - Flag a report 3× → it disappears from the public feed (status → hidden).
  - Visit `#admin` → sign in as the admin → the flagged/hidden report shows → Restore/Delete work.
  - DevTools offline → file a report → it queues; go online → it auto-submits (the "queued" banner clears).
- [ ] **Step 4: Deploy** — ensure the two `VITE_SUPABASE_*` vars exist in Vercel, then `git push origin master` (Vercel auto-deploys). Verify on `https://lindol.app`: the Report button is live and a test report round-trips.
- [ ] **Step 5: Final commit/tag**
```bash
git tag v0.2-reports
```

---

## Self-Review notes (applied)
- **Spec coverage:** data model ✓ (Task 0), capture flow GPS→category→note→camera→submit ✓ (Task 10), photos-only + compression ✓ (Task 4), anonymous + device id ✓ (Tasks 2,10), sensitivity gate ✓ (Task 9), flag→auto-hide at 3 ✓ (Task 0 RPC + Task 9), admin takedown ✓ (Task 12), offline write-queue + flush on reconnect ✓ (Tasks 6,7,13), report pins + layer toggles ✓ (Task 11), feed sorted by distance ✓ (Task 9), realtime ✓ (Task 7), offline photo/reports caching ✓ (Task 14).
- **Type consistency:** the `Report` shape (`createdAt`, `photoUrl`, `flagCount`, `distanceKm`) is produced by `normalizeRow` (Task 5) and consumed identically by `useReports`, `ReportFeed`/`ReportCard`, `QuakeMap`, and `AdminPage`. `submit(report)`/`flag(id)` signatures match between `useReports`, `ReportSheet`, and `App`. Category keys (`damage/road/fire/help/safe/other`) are consistent across `reportSchema`, the DB `check` constraint, markers, and the legend.
- **No placeholders:** every code step is complete; the only manual step is Task 0 Step 4 (operator provisions Supabase), which is inherent and fully enumerated.
- **YAGNI:** no PostGIS (client-side distance), no video, no per-row server rate limiting (client throttle + moderation) for v1.
```
