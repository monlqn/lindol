# LINDOL — Phase 3: Aftershock Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alert users when a new significant aftershock (≥ M4.5) hits Southern Mindanao — a loud in-app alarm + banner when the app is open (Phase A), and a web-push notification when the app is closed (Phase B).

**Architecture:** Phase A polls the USGS feed on an interval and detects newly-arrived quakes above the threshold, firing a Web-Audio alarm + vibration + a prominent banner — no backend. Phase B adds real Web Push: a `push_subscriptions` table, a client subscribe flow (Notification permission + PushManager + VAPID), a custom service-worker push handler (added via Workbox `importScripts`), and a Supabase Edge Function (triggered by pg_cron) that polls USGS and sends notifications to all subscribers.

**Tech Stack:** Existing Vite + React + vite-plugin-pwa (Workbox) + Supabase. Adds: Web Audio + Vibration APIs, Web Push API + VAPID, a Supabase Edge Function (Deno, `npm:web-push`), pg_cron + pg_net.

**Honesty constraint (important):** These alerts fire when USGS *reports* a quake — typically **1–5 minutes after** it happened. This is **NOT** an earthquake early-warning system (which warns seconds *before* shaking). All alert copy must say *"M4.8 aftershock reported"* / *"reported 2 min ago"*, never *"incoming"* or *"warning."*

**Phasing:** Phase A (Tasks 1–6) ships a complete, useful feature with zero backend/operator setup. Phase B (Tasks 7–14) adds the push backend and has operator steps (VAPID, Edge Function deploy, secrets, cron) clearly marked.

---

## Config addition (used throughout)
Add `alertMinMag: 4.5` to the `REGION` object in `src/config.js`.

---

# PHASE A — In-app alarm (no backend)

## Task 1: Add alert threshold to config

**Files:** Modify `src/config.js`

- [ ] **Step 1: Add the field**
In `src/config.js`, add `alertMinMag: 4.5,` to the `REGION` object (after `minMagnitude`).

- [ ] **Step 2: Commit**
```bash
git add src/config.js
git commit -m "feat(alerts): add alert magnitude threshold to config"
```

---

## Task 2: `lib/alarm.js` — audio alarm + vibration (TDD the guard)

**Files:** Create `src/lib/alarm.js`, `src/lib/alarm.test.js`

- [ ] **Step 1: Write the failing test** (jsdom has no real AudioContext; test the unlock-state guard, which is pure)
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isArmed, arm } from './alarm.js';

beforeEach(() => { /* module state resets per import is not automatic; arm() is idempotent */ });

describe('alarm arming', () => {
  it('starts disarmed and arms after arm()', () => {
    // fresh state at import; arm() flips it on
    arm({ AudioContextCtor: vi.fn(() => ({ resume: () => {}, createOscillator: () => ({ connect(){}, start(){}, stop(){}, frequency:{setValueAtTime(){}} }), createGain: () => ({ connect(){}, gain:{setValueAtTime(){}, exponentialRampToValueAtTime(){}} }), currentTime: 0, destination: {} })) });
    expect(isArmed()).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect fail** — `npm test` → not defined.

- [ ] **Step 3: Implement `src/lib/alarm.js`**
```js
// Loud attention alarm via Web Audio. Browsers block audio until a user gesture,
// so callers must invoke arm() from a click/tap first (that also unlocks playback).
let ctx = null;
let armed = false;

export function isArmed() { return armed; }

// Call from a user gesture (e.g. the "Enable alarm" tap) to unlock audio.
export function arm({ AudioContextCtor } = {}) {
  try {
    const Ctor = AudioContextCtor || window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    ctx = ctx || new Ctor();
    ctx.resume?.();
    armed = true;
    return true;
  } catch {
    return false;
  }
}

// Play a loud two-tone warble for ~`seconds`, plus vibration where supported.
export function playAlarm(seconds = 3) {
  if (!armed || !ctx) return;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.9, now + 0.05);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.connect(gain);
  // warble between 880 and 1320 Hz
  for (let i = 0; i < seconds * 4; i++) {
    osc.frequency.setValueAtTime(i % 2 ? 1320 : 880, now + i * 0.25);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.start(now);
  osc.stop(now + seconds);
  try { navigator.vibrate?.([400, 200, 400, 200, 400]); } catch { /* unsupported */ }
}
```

- [ ] **Step 4: Run, expect pass.** **Step 5: Commit** `feat(alerts): add web-audio alarm + vibration`.

---

## Task 3: `features/alerts/detectNewQuakes.js` — pure detection (TDD)

**Files:** Create `src/features/alerts/detectNewQuakes.js`, `detectNewQuakes.test.js`

- [ ] **Step 1: Failing test**
```js
import { describe, it, expect } from 'vitest';
import { detectNewAlerts } from './detectNewQuakes.js';

const q = (id, mag, time) => ({ id, mag, time, place: 'x', lat: 7, lng: 126 });

describe('detectNewAlerts', () => {
  it('returns nothing for the initial baseline (seen empty)', () => {
    const seen = new Set();
    const out = detectNewAlerts([q('a', 5, 2000)], seen, 4.5, 1000);
    expect(out).toEqual([]);          // first sighting only establishes the baseline
    expect(seen.has('a')).toBe(true);
  });
  it('flags a new quake above threshold after baseline', () => {
    const seen = new Set(['a']);
    const out = detectNewAlerts([q('a', 5, 2000), q('b', 4.8, 3000)], seen, 4.5, 1000);
    expect(out.map((x) => x.id)).toEqual(['b']);
  });
  it('ignores new quakes below threshold', () => {
    const seen = new Set(['a']);
    const out = detectNewAlerts([q('a', 5, 2000), q('c', 3.9, 3000)], seen, 4.5, 1000);
    expect(out).toEqual([]);
    expect(seen.has('c')).toBe(true); // still recorded so it won't re-fire
  });
  it('ignores quakes older than sinceMs (avoids alarming on history)', () => {
    const seen = new Set(['a']);
    const out = detectNewAlerts([q('a', 5, 2000), q('d', 6, 500)], seen, 4.5, 1000);
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `src/features/alerts/detectNewQuakes.js`**
```js
// Pure detector. Given the current quake list, the set of already-seen ids, the
// magnitude threshold, and a `sinceMs` cutoff (don't alarm on events older than this),
// returns the quakes that are NEW alerts and records every id into `seen`.
// On the first call (seen empty) it only establishes the baseline and returns [].
export function detectNewAlerts(quakes, seen, minMag, sinceMs) {
  const baseline = seen.size === 0;
  const alerts = [];
  for (const qk of quakes) {
    const isNew = !seen.has(qk.id);
    seen.add(qk.id);
    if (baseline) continue;
    if (isNew && qk.mag >= minMag && qk.time >= sinceMs) alerts.push(qk);
  }
  return alerts;
}
```

- [ ] **Step 4: Run, expect pass.** **Step 5: Commit** `feat(alerts): add pure new-quake detector`.

---

## Task 4: Poll on an interval in `useQuakes`

**Files:** Modify `src/features/quakes/useQuakes.js`

- [ ] **Step 1: Add a 60s refresh interval**
In `useQuakes`, inside the existing `useEffect`, after the initial `load()` call, add a polling interval so new quakes arrive while the app is open:
```js
    load();
    const poll = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(poll); };
```
(Replace the existing `return () => { cancelled = true; };` with the version above. Keep everything else.)

- [ ] **Step 2: Verify build** — `npm run build` succeeds; `npm test` still passes.

- [ ] **Step 3: Commit** `feat(quakes): poll USGS every 60s for fresh data`.

---

## Task 5: `features/alerts/useQuakeAlerts.js` + `AlertBanner.jsx`

**Files:** Create `src/features/alerts/useQuakeAlerts.js`, `src/components/AlertBanner.jsx`

- [ ] **Step 1: `src/features/alerts/useQuakeAlerts.js`**
```js
import { useEffect, useRef, useState } from 'react';
import { detectNewAlerts } from './detectNewQuakes.js';
import { playAlarm } from '../../lib/alarm.js';
import { REGION } from '../../config.js';

// Watches the live quake list; when a new quake >= threshold arrives after the app
// opened, fires the alarm (if soundOn) and surfaces it as `alert`.
export function useQuakeAlerts(quakes, soundOn) {
  const seen = useRef(new Set());
  const since = useRef(Date.now() - 5 * 60000); // allow events from the last 5 min
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    if (!quakes || quakes.length === 0) return;
    const fresh = detectNewAlerts(quakes, seen.current, REGION.alertMinMag, since.current);
    if (fresh.length) {
      const newest = fresh.reduce((a, b) => (b.time > a.time ? b : a));
      setAlert(newest);
      if (soundOn) playAlarm(3);
    }
  }, [quakes, soundOn]);

  return { alert, dismiss: () => setAlert(null) };
}
```

- [ ] **Step 2: `src/components/AlertBanner.jsx`**
```jsx
import { formatKm } from '../lib/geo.js';
import { relativeTime, formatClock } from '../lib/time.js';

// Prominent "an aftershock was reported" banner. NOT an early warning — copy says "reported".
export default function AlertBanner({ alert, onDismiss }) {
  if (!alert) return null;
  return (
    <div className="alert-banner" role="alert">
      <div className="ab-mag">{alert.mag.toFixed(1)}</div>
      <div className="ab-body">
        <div className="ab-title">M{alert.mag.toFixed(1)} aftershock reported</div>
        <div className="ab-sub">{alert.place} · {formatClock(alert.time)} ({relativeTime(alert.time)})
          {alert.distanceKm != null ? ` · ≈ ${formatKm(alert.distanceKm)} from you` : ''}</div>
        <div className="ab-note">Reported by USGS — this is not an early warning. If shaking starts: Drop, Cover, Hold On.</div>
      </div>
      <button className="ab-close" onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
```

- [ ] **Step 3: Append CSS to `src/styles/global.css`**
```css
/* ---------- aftershock alert banner ---------- */
.alert-banner{position:fixed; z-index:1400; top:10px; left:50%; transform:translateX(-50%);
  width:min(var(--app-w),calc(100% - 20px)); display:flex; gap:12px; align-items:flex-start;
  padding:14px; background:var(--c-help); color:#fff; border-radius:14px; box-shadow:var(--shadow-lg);
  animation:rise .35s both}
.ab-mag{font-family:var(--mono); font-weight:600; font-size:30px; line-height:1; flex:none}
.ab-body{flex:1; min-width:0}
.ab-title{font-family:var(--font); font-weight:700; font-size:15px}
.ab-sub{font-size:12px; opacity:.95; margin-top:2px; line-height:1.35}
.ab-note{font-size:10.5px; opacity:.85; margin-top:6px; line-height:1.3}
.ab-close{flex:none; background:rgba(255,255,255,.2); border:0; color:#fff; width:26px; height:26px;
  border-radius:8px; cursor:pointer; font-size:13px}
```

- [ ] **Step 4: Build + commit** — `npm run build` ok. `git commit -m "feat(alerts): add alert hook + reported-aftershock banner"`.

---

## Task 6: Wire alerts + sound toggle into `App.jsx`

**Files:** Modify `src/App.jsx`

- [ ] **Step 1: Add imports**
```jsx
import { useState } from 'react'; // already imported — keep single import
import AlertBanner from './components/AlertBanner.jsx';
import { useQuakeAlerts } from './features/alerts/useQuakeAlerts.js';
import { arm } from './lib/alarm.js';
```

- [ ] **Step 2: Use the hook + a soundOn toggle**
After the existing hooks in `App()`:
```jsx
  const [soundOn, setSoundOn] = useState(false);
  const { alert, dismiss } = useQuakeAlerts(all, soundOn);
  const toggleSound = () => {
    if (!soundOn) arm();          // unlock audio from this user gesture
    setSoundOn((v) => !v);
  };
```

- [ ] **Step 3: Render the banner + a small toggle**
Add `<AlertBanner alert={alert} onDismiss={dismiss} />` just inside the top of the `.app` div (before `<StatusBar .../>`).
Add a sound toggle into the masthead area — render it right after `<Masthead quakes={all} />`:
```jsx
      <button className="alert-toggle" onClick={toggleSound}>
        {soundOn ? '🔔 Aftershock alarm: ON' : '🔕 Enable aftershock alarm'}
      </button>
```

- [ ] **Step 4: Append CSS to `src/styles/global.css`**
```css
.alert-toggle{display:block; width:calc(100% - 32px); margin:10px 16px 0; padding:9px;
  font-family:var(--mono); font-size:11px; letter-spacing:.04em; border-radius:10px; cursor:pointer;
  border:1px solid var(--line-strong); background:var(--card); color:var(--ink-soft)}
.alert-toggle:hover{border-color:var(--ember); color:var(--ember-deep)}
```

- [ ] **Step 5: Build + manual test**
`npm run build`; then `npm run dev` and confirm: the toggle flips ON (and the browser allows audio after the click), and `npm test` passes. (You can simulate an alert by temporarily lowering `alertMinMag` to 0 in config and reloading — expect the banner + sound — then revert.)

- [ ] **Step 6: Commit** `feat(alerts): wire in-app alarm + banner + sound toggle`.

**✅ Phase A complete — a working loud aftershock alarm ships here. Deploy (`git push`) before starting Phase B.**

---

# PHASE B — Web push (notify when app is closed)

> **iOS note:** web push only works on iOS 16.4+ and ONLY after the user "Adds to Home Screen". The UI must tell iOS users to install first.

## Task 7: Generate VAPID keys (operator + me)

**Files:** Create `.env.local` additions (gitignored), document in `.env.example`

- [ ] **Step 1: Generate the keypair**
Run: `npx web-push generate-vapid-keys`
It prints a **Public Key** and **Private Key**.

- [ ] **Step 2: Record them**
- Add to `.env.local`: `VITE_VAPID_PUBLIC_KEY=<public key>`
- Add the same line (placeholder) to `.env.example`.
- Keep the **private key** for Task 12 (Edge Function secret) — do NOT put the private key in any `VITE_` var or client code.
- Add `VITE_VAPID_PUBLIC_KEY=<public key>` to Vercel env vars (Production + Preview).

- [ ] **Step 3: Commit** (`.env.example` only)
```bash
git add .env.example
git commit -m "feat(push): document VAPID public key env var"
```

## Task 8: `push_subscriptions` + `alert_state` schema (operator runs SQL)

**Files:** Create `supabase/push-schema.sql`

- [ ] **Step 1: Write `supabase/push-schema.sql`**
```sql
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
-- anyone may register their own device subscription (upsert by endpoint)
create policy "anon subscribe" on public.push_subscriptions
  for insert to anon with check (true);
create policy "anon update own" on public.push_subscriptions
  for update to anon using (true) with check (true);

-- tracks the newest quake we have already alerted on (single row)
create table if not exists public.alert_state (
  id int primary key default 1,
  last_quake_time bigint not null default 0
);
insert into public.alert_state (id, last_quake_time) values (1, 0) on conflict do nothing;
```

- [ ] **Step 2: OPERATOR** — paste/run in the Supabase SQL editor.

- [ ] **Step 3: Commit** `feat(push): add subscriptions + alert state schema`.

## Task 9: `lib/push.js` — base64 helper (TDD) + subscribe

**Files:** Create `src/lib/push.js`, `src/lib/push.test.js`

- [ ] **Step 1: Failing test** (test the pure key converter)
```js
import { describe, it, expect } from 'vitest';
import { urlBase64ToUint8Array } from './push.js';

describe('urlBase64ToUint8Array', () => {
  it('decodes a url-safe base64 VAPID key to bytes', () => {
    const out = urlBase64ToUint8Array('AQAB'); // 0x01 0x00 0x01
    expect(Array.from(out)).toEqual([1, 0, 1]);
  });
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `src/lib/push.js`**
```js
// Convert a URL-safe base64 VAPID key into the Uint8Array PushManager expects.
export function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Subscribe this device to push using the app's service worker + VAPID public key.
// Returns the PushSubscription (JSON) or throws.
export async function subscribeToPush(vapidPublicKey) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push not supported on this device/browser.');
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notification permission denied.');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  return sub.toJSON();
}
```

- [ ] **Step 4: Run, expect pass.** **Step 5: Commit** `feat(push): add subscribe + key helper`.

## Task 10: `features/alerts/pushApi.js` — store subscription

**Files:** Create `src/features/alerts/pushApi.js`

- [ ] **Step 1: Implement**
```js
import { supabase } from '../../lib/supabase.js';

// Upsert a device push subscription into Supabase.
export async function savePushSubscription(subJson) {
  const { endpoint, keys } = subJson;
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'endpoint' });
  if (error) throw error;
}
```

- [ ] **Step 2: Build + commit** `feat(push): persist subscription to supabase`.

## Task 11: Service-worker push handler + Workbox wiring

**Files:** Create `public/push-sw.js`; modify `vite.config.js`

- [ ] **Step 1: `public/push-sw.js`**
```js
/* global self, clients */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'Aftershock reported';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'lindol-aftershock',
    renotify: true,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
```

- [ ] **Step 2: Wire into Workbox** — in `vite.config.js`, inside the `VitePWA({ workbox: { ... } })` block, add `importScripts: ['/push-sw.js'],` (alongside the existing `runtimeCaching`). Keep everything else.

- [ ] **Step 3: Build** — `npm run build`; confirm the generated `dist/sw.js` references `push-sw.js` (it will `importScripts` it). Commit `feat(push): add SW push + notificationclick handlers`.

## Task 12: Supabase Edge Function `alerts` (operator deploys)

**Files:** Create `supabase/functions/alerts/index.ts`

- [ ] **Step 1: Write the function**
```ts
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SB_URL")!, Deno.env.get("SB_SERVICE_KEY")!);
webpush.setVapidDetails(
  "mailto:" + (Deno.env.get("VAPID_SUBJECT") || "alerts@lindol.app"),
  Deno.env.get("VAPID_PUBLIC")!,
  Deno.env.get("VAPID_PRIVATE")!,
);

const BBOX = "minlatitude=4.5&maxlatitude=9.5&minlongitude=124&maxlongitude=128";
const MIN_MAG = 4.5;

Deno.serve(async () => {
  const start = new Date(Date.now() - 30 * 60000).toISOString();
  const usgs = await fetch(
    `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&${BBOX}&minmagnitude=${MIN_MAG}&orderby=time`,
  ).then((r) => r.json());

  const { data: state } = await sb.from("alert_state").select("last_quake_time").eq("id", 1).single();
  const last = state?.last_quake_time ?? 0;

  const fresh = (usgs.features ?? [])
    .filter((f: any) => f.properties?.time > last)
    .sort((a: any, b: any) => a.properties.time - b.properties.time);
  if (fresh.length === 0) return new Response("no new", { status: 200 });

  const { data: subs } = await sb.from("push_subscriptions").select("*");
  for (const f of fresh) {
    const payload = JSON.stringify({
      title: `M${f.properties.mag.toFixed(1)} aftershock reported`,
      body: `${f.properties.place} — reported just now (USGS). Not an early warning.`,
      url: "https://lindol.app/",
    });
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
      } catch (e: any) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
  }
  const newest = fresh[fresh.length - 1].properties.time;
  await sb.from("alert_state").update({ last_quake_time: newest }).eq("id", 1);
  return new Response(`sent for ${fresh.length} quake(s)`, { status: 200 });
});
```

- [ ] **Step 2: OPERATOR — deploy + secrets.** Either via Supabase CLI (`supabase functions deploy alerts --no-verify-jwt`) or the dashboard Functions editor. Set these **Function secrets** (Dashboard → Edge Functions → Secrets):
  - `SB_URL` = your project URL
  - `SB_SERVICE_KEY` = the **service_role** key (server-side only — never in the client)
  - `VAPID_PUBLIC` = VAPID public key (Task 7)
  - `VAPID_PRIVATE` = VAPID private key (Task 7)
  - `VAPID_SUBJECT` = a contact mailto, e.g. `alerts@lindol.app`

- [ ] **Step 3: Commit** `feat(push): add USGS-poll + web-push edge function`.

## Task 13: Schedule the function with pg_cron (operator runs SQL)

**Files:** Create `supabase/alerts-cron.sql`

- [ ] **Step 1: Write `supabase/alerts-cron.sql`** (replace `<PROJECT-REF>` and `<ANON_OR_FUNCTION_TOKEN>`)
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'poll-aftershocks',
  '* * * * *',  -- every minute
  $$
    select net.http_post(
      url := 'https://<PROJECT-REF>.functions.supabase.co/alerts',
      headers := jsonb_build_object('Authorization', 'Bearer <ANON_OR_FUNCTION_TOKEN>')
    );
  $$
);
```

- [ ] **Step 2: OPERATOR** — run in the SQL editor (after the function is deployed with `--no-verify-jwt`, the token can be the anon/publishable key).

- [ ] **Step 3: Commit** `feat(push): schedule aftershock poll via pg_cron`.

## Task 14: Push opt-in UI in the app

**Files:** Modify `src/App.jsx`

- [ ] **Step 1: Add a "Notify me of aftershocks" control** under the alarm toggle:
```jsx
import { subscribeToPush } from './lib/push.js';
import { savePushSubscription } from './features/alerts/pushApi.js';
// ...
  const enablePush = async () => {
    try {
      const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!key) return showToast('Push not configured yet', '#CC2A2A');
      const sub = await subscribeToPush(key);
      await savePushSubscription(sub);
      showToast('You’ll be notified of aftershocks', '#3F7D43');
    } catch (e) {
      showToast(e.message || 'Could not enable notifications', '#CC2A2A');
    }
  };
```
Render under the alarm toggle:
```jsx
      <button className="alert-toggle" onClick={enablePush}>
        🔔 Notify me even when the app is closed
      </button>
```

- [ ] **Step 2: Build + manual end-to-end test**
`npm run build`, deploy, then on an **installed** PWA: tap "Notify me…", grant permission, confirm a row appears in `push_subscriptions`. Trigger the function manually (or wait for cron) with a recent ≥M4.5 quake present and confirm the notification arrives with the app closed.

- [ ] **Step 3: Commit** `feat(push): add push opt-in control`.

---

## Self-Review notes (applied)
- **Spec coverage:** in-app loud alarm ✓ (Tasks 2,6), vibration ✓ (Task 2), banner ✓ (Task 5), new-quake detection w/o alarming on history ✓ (Task 3, baseline + sinceMs), M4.5 threshold ✓ (Task 1), polling ✓ (Task 4), web push subscribe ✓ (Tasks 9,10,14), SW handler ✓ (Task 11), backend poll+send ✓ (Task 12), cron ✓ (Task 13), honest "reported / not early warning" copy ✓ (Tasks 5,12).
- **Type consistency:** `detectNewAlerts(quakes, seen, minMag, sinceMs)` signature matches its caller in `useQuakeAlerts`. `arm()`/`playAlarm()`/`isArmed()` consistent across alarm.js, App, tests. `subscribeToPush` returns the JSON consumed by `savePushSubscription`.
- **YAGNI:** no per-user thresholds, no quiet-hours, no topics for v1.
- **Operator steps** are explicitly flagged (Tasks 7,8,12,13) — VAPID gen, schema SQL, function deploy + secrets, cron.
```
