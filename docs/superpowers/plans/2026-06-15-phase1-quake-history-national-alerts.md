# Phase 1: Durable Quake History + National Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continuously archive every national M2.0+ quake into a durable Supabase table, and widen background push alerts from Southern-Mindanao-only to national + per-subscriber location, both from one broadened fetch in the existing `alerts` edge function.

**Architecture:** A new `quake_history` table stores one lossless row per source report (keyed by the source's own id; de-dup is a read-time concern for later). The existing per-minute `alerts` edge function is refactored to fetch the whole-Philippines M2.0+ feed once, upsert all of it into `quake_history` (best-effort, never blocking alerts), then push only the fresh M4.5+ subset to nearby subscribers anywhere in the country.

**Tech Stack:** Supabase Postgres + pg_cron, a Deno edge function (`supabase/functions/alerts/index.ts`), `@supabase/supabase-js`, `web-push`. Sources: PHIVOLCS (cached `/api/phivolcs` proxy), USGS FDSN, EMSC FDSN.

---

## File Structure

- Create: `supabase/quake-history.sql` — one-time migration: the `quake_history` table, its time index, and RLS (public read, service-role-only write).
- Modify: `supabase/functions/alerts/index.ts` — broaden the fetch to national M2.0+, add the archive upsert, and split the alert threshold (`ALERT_MIN`) from the fetch threshold (`FETCH_MIN`).

No other files change. The cron (`supabase/alerts-cron.sql`) is unchanged.

## Notes on verification

This subsystem has no Vitest surface (the edge function is Deno and, like the existing `alerts` code, is not unit-tested). Verification is type-checking (`deno check`) plus operational checks after deploy. Deploy itself (running the SQL, redeploying the function) is manual and is captured as the final task for the user.

---

## Task 1: Create the `quake_history` migration

**Files:**
- Create: `supabase/quake-history.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/quake-history.sql` with exactly:

```sql
-- Durable archive of every quake we see, so the perishable PHIVOLCS catalog is preserved
-- continuously (PHIVOLCS has no historical API). One row per SOURCE report (lossless); the
-- app de-dupes into logical events at read time. Written only by the `alerts` Edge Function
-- (service_role); world-readable for a future timeline UI. Run ONCE in the Supabase SQL editor.

create table if not exists public.quake_history (
  id          text primary key,         -- source-specific stable id (phivolcs:.. / usgs id / emsc:..)
  source      text not null,            -- 'phivolcs' | 'usgs' | 'emsc'
  mag         double precision not null,
  place       text,
  time        bigint not null,          -- epoch ms (matches the app's Quake shape)
  lat         double precision not null,
  lng         double precision not null,
  depth_km    double precision,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create index if not exists quake_history_time_idx on public.quake_history (time desc);

alter table public.quake_history enable row level security;

-- Public read (for a future read-back / timeline UI). There is no anon write policy, so only
-- the service_role cron (which bypasses RLS) can insert/update.
drop policy if exists "quake_history public read" on public.quake_history;
create policy "quake_history public read" on public.quake_history for select using (true);

-- Verify:   select source, count(*) from public.quake_history group by source;
-- Dupes?:   select id, count(*) from public.quake_history group by id having count(*) > 1;
```

- [ ] **Step 2: Sanity-check the file is valid SQL text**

Run: `node -e "const s=require('fs').readFileSync('supabase/quake-history.sql','utf8'); if(!/create table if not exists public\.quake_history/.test(s)||!/enable row level security/.test(s)) throw new Error('migration missing required statements'); console.log('ok, '+s.length+' chars')"`
Expected: prints `ok, <n> chars`. (We cannot execute Postgres here; this only confirms the file was written with the key statements. Actual execution happens in Task 3 in the Supabase SQL editor.)

- [ ] **Step 3: Commit**

```bash
git add supabase/quake-history.sql
git commit -m "feat(db): quake_history table (durable per-source quake archive, RLS public-read)"
```

---

## Task 2: Refactor the `alerts` edge function (national fetch + archive + national alerts)

**Files:**
- Modify: `supabase/functions/alerts/index.ts`

This is one coordinated rewrite of a single 160-line file. Replace the **entire file contents** with the version below, then type-check and commit. The changes vs the current file are: national `BBOX`; split `FETCH_MIN` (2.0) / `ALERT_MIN` (4.5); 24h fetch window; `Q` gains `id` and `depthKm`; each fetcher captures `id` + `depthKm`; a best-effort archive upsert into `quake_history`; the alert filter now requires `mag >= ALERT_MIN`; the watermark tracks alert-eligible events only; the response reports `archived`.

- [ ] **Step 1: Replace the whole file**

Overwrite `supabase/functions/alerts/index.ts` with exactly:

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

// Per-minute background job (invoked by pg_cron - see supabase/alerts-cron.sql). From ONE national
// fetch it does two things: (1) archives every M2.0+ quake into quake_history so the perishable
// PHIVOLCS catalog is preserved continuously, and (2) sends background push for the M4.5+ subset to
// subscribers near the epicentre, anywhere in the Philippines. Sources are complementary: PHIVOLCS
// (the local authority, via our cached /api/phivolcs) is preferred, with USGS + EMSC as backup.
// Push is an awareness alert (arrives minutes after detection), not early warning.
const BBOX = "minlatitude=4.5&maxlatitude=21.5&minlongitude=116&maxlongitude=127"; // whole PH (matches REGION.bbox)
const FETCH_MIN = 2.0;   // archive everything at or above this
const ALERT_MIN = 4.5;   // only push at or above this (never spam small quakes)
const FETCH_WINDOW_MS = 24 * 60 * 60000; // look back 24h each run; upsert is idempotent, so this self-heals a missed run

// "Felt" radius grows with magnitude - notify only subscribers who'd plausibly feel it.
function feltRadiusKm(mag: number) {
  if (mag >= 7) return 600;
  if (mag >= 6) return 350;
  if (mag >= 5) return 180;
  return 90;
}
const PHIVOLCS_API = `https://lindol.app/api/phivolcs?days=1&min=${FETCH_MIN}`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Q = { id: string; time: number; mag: number; place: string; lat: number; lng: number; depthKm: number | null; source: string };

// Same physical quake if close in time, place and magnitude (de-dupes USGS vs PHIVOLCS for alerts).
function sameQuake(a: Q, b: Q) {
  if (Math.abs(a.time - b.time) > 90000) return false;
  if (Math.abs(a.mag - b.mag) > 1.2) return false;
  return haversineKm(a.lat, a.lng, b.lat, b.lng) <= 80;
}

async function fetchUsgs(): Promise<Q[]> {
  try {
    const start = new Date(Date.now() - FETCH_WINDOW_MS).toISOString();
    const j = await fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&${BBOX}&minmagnitude=${FETCH_MIN}&orderby=time`,
    ).then((r) => r.json());
    return (j.features ?? []).map((f: any) => {
      const [lng, lat, depth] = f.geometry?.coordinates ?? [];
      return { id: f.id, time: f.properties?.time, mag: f.properties?.mag, place: f.properties?.place ?? "Philippines", lat, lng, depthKm: Number.isFinite(depth) ? depth : null, source: "USGS" };
    }).filter((q: Q) => !!q.id && Number.isFinite(q.time) && Number.isFinite(q.mag) && Number.isFinite(q.lat) && Number.isFinite(q.lng));
  } catch {
    return [];
  }
}

async function fetchPhivolcs(): Promise<Q[]> {
  try {
    const j = await fetch(PHIVOLCS_API).then((r) => r.json());
    const cutoff = Date.now() - FETCH_WINDOW_MS;
    return (j.quakes ?? [])
      .map((q: any) => ({ id: q.id, time: q.time, mag: q.mag, place: q.place ?? "Philippines", lat: q.lat, lng: q.lng, depthKm: Number.isFinite(q.depthKm) ? q.depthKm : null, source: "PHIVOLCS" }))
      .filter((q: Q) => !!q.id && Number.isFinite(q.time) && Number.isFinite(q.mag) && Number.isFinite(q.lat) && Number.isFinite(q.lng) && q.time >= cutoff);
  } catch {
    return [];
  }
}

async function fetchEmsc(): Promise<Q[]> {
  try {
    const start = new Date(Date.now() - FETCH_WINDOW_MS).toISOString();
    const j = await fetch(
      `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&start=${start}&minlat=4.5&maxlat=21.5&minlon=116&maxlon=127&minmag=${FETCH_MIN}&orderby=time&limit=500`,
    ).then((r) => r.json());
    return (j.features ?? []).map((f: any) => {
      const pr = f.properties ?? {};
      const c = f.geometry?.coordinates ?? [];
      return {
        id: `emsc:${pr.unid ?? pr.source_id ?? f.id}`,
        time: typeof pr.time === "string" ? Date.parse(pr.time) : pr.time,
        mag: pr.mag, place: pr.flynn_region ?? "Philippines", lat: c[1] ?? pr.lat, lng: c[0] ?? pr.lon, depthKm: Number.isFinite(c[2]) ? c[2] : null, source: "EMSC",
      };
    }).filter((q: Q) => !!q.id && Number.isFinite(q.time) && Number.isFinite(q.mag) && Number.isFinite(q.lat) && Number.isFinite(q.lng));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  try {
    const SB_URL = Deno.env.get("SB_URL");
    const SB_SERVICE_KEY = Deno.env.get("SB_SERVICE_KEY");
    const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC");
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE");
    const subjRaw = Deno.env.get("VAPID_SUBJECT") || "alerts@lindol.app";
    const VAPID_SUBJECT = /^(mailto:|https?:)/.test(subjRaw) ? subjRaw : "mailto:" + subjRaw;

    const missing = Object.entries({ SB_URL, SB_SERVICE_KEY, VAPID_PUBLIC, VAPID_PRIVATE })
      .filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) return json({ error: "Missing secrets: " + missing.join(", ") }, 500);

    // The function URL is public; only the pg_cron job (which sends the service_role key,
    // see alerts-cron.sql) may trigger this.
    if (req.headers.get("authorization") !== `Bearer ${SB_SERVICE_KEY}`) {
      return json({ error: "unauthorized" }, 401);
    }

    const webpush = (await import("npm:web-push@3.6.7")).default;
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC!, VAPID_PRIVATE!);

    const sb = createClient(SB_URL!, SB_SERVICE_KEY!);

    // PHIVOLCS first so it wins on duplicates; USGS + EMSC fill anything it didn't report.
    const [phiv, usgs, emsc] = await Promise.all([fetchPhivolcs(), fetchUsgs(), fetchEmsc()]);

    // (1) Archive: upsert every raw source record (lossless; one row per source report). Keyed by
    // the source's own id, so re-fetching the same event each minute updates in place instead of
    // duplicating. Wrapped so an archive failure can never block alerts. last_seen is refreshed on
    // every upsert; first_seen is omitted here so its default is set on insert and preserved after.
    let archived = 0;
    try {
      const rows = [...phiv, ...usgs, ...emsc].map((q) => ({
        id: q.id, source: q.source.toLowerCase(), mag: q.mag, place: q.place,
        time: q.time, lat: q.lat, lng: q.lng, depth_km: q.depthKm, last_seen: new Date().toISOString(),
      }));
      // De-dup within this batch (Postgres ON CONFLICT cannot touch the same row twice in one insert).
      const uniq = Array.from(new Map(rows.map((r) => [r.id, r])).values());
      if (uniq.length) {
        const { error } = await sb.from("quake_history").upsert(uniq, { onConflict: "id" });
        if (!error) archived = uniq.length;
      }
    } catch { /* archive is best-effort; never break alerts */ }

    // (2) Alerts: merge the sources, then push only the fresh M4.5+ subset to nearby subscribers.
    const merged: Q[] = [...phiv];
    for (const u of [...usgs, ...emsc]) if (!merged.some((m) => sameQuake(m, u))) merged.push(u);

    const { data: state } = await sb.from("alert_state").select("last_quake_time").eq("id", 1).single();
    const last = state?.last_quake_time ?? 0;

    // Watermark tracks ALERT-eligible events only, so archiving small M2.0 quakes can never advance
    // it past a slightly-late-published M4.5 and suppress that alert.
    const fresh = merged.filter((q) => q.mag >= ALERT_MIN && q.time > last).sort((a, b) => a.time - b.time);
    if (fresh.length === 0) {
      return json({ ok: true, sent: 0, archived, note: "no new alertable quakes", sources: { phivolcs: phiv.length, usgs: usgs.length, emsc: emsc.length } });
    }

    // Advance the watermark to the newest alertable event seen this run (pre-send) so a duplicate
    // from another source can't re-trigger next run.
    const maxTime = fresh.reduce((m, q) => Math.max(m, q.time), last);

    const { data: subs } = await sb.from("push_subscriptions").select("*");
    let sent = 0;
    for (const q of fresh) {
      const payload = JSON.stringify({
        title: `M${q.mag.toFixed(1)} earthquake near you`,
        body: `${q.place} - reported just now (${q.source}). Not an early warning.`,
        url: "https://lindol.app/",
      });
      for (const s of subs ?? []) {
        if (s.lat != null && s.lng != null && q.lat != null &&
            haversineKm(s.lat, s.lng, q.lat, q.lng) > feltRadiusKm(q.mag)) continue;
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      }
    }
    await sb.from("alert_state").update({ last_quake_time: maxTime }).eq("id", 1);
    return json({ ok: true, quakes: fresh.length, archived, sources: { phivolcs: phiv.length, usgs: usgs.length, emsc: emsc.length }, sent });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
```

- [ ] **Step 2: Type-check the function**

Run: `deno check supabase/functions/alerts/index.ts`
Expected: completes with no type errors. (If `deno` is not installed: install it from https://deno.land, or skip and rely on the operational checks in Task 3. Do NOT substitute the frontend `npm run build` or Vitest here; they do not type-check this Deno file.)

- [ ] **Step 3: Confirm the key changes are present (quick self-check)**

Run: `node -e "const s=require('fs').readFileSync('supabase/functions/alerts/index.ts','utf8'); for (const t of ['maxlatitude=21.5','FETCH_MIN','ALERT_MIN','quake_history','q.mag >= ALERT_MIN','archived']) if(!s.includes(t)) throw new Error('missing: '+t); console.log('all national+archive markers present')"`
Expected: prints `all national+archive markers present`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/alerts/index.ts
git commit -m "feat(alerts): national fetch + archive to quake_history; push M4.5+ by subscriber location"
```

---

## Task 3: Deploy and verify (manual, operated by the user)

These steps run against live Supabase and cannot be done by an automated worker. Hand this checklist to the user.

- [ ] **Step 1: Create the table.** In the Supabase SQL editor, paste and run the contents of `supabase/quake-history.sql`.

- [ ] **Step 2: Redeploy the function.** Deploy the updated `alerts` function via the Supabase dashboard (per the project's known CLI Deno-parse issue). Secrets and the `poll-aftershocks` cron are unchanged.

- [ ] **Step 3: Verify capture is accruing.** After a few minutes, in the SQL editor:
  ```sql
  select source, count(*) from public.quake_history group by source;        -- phivolcs should dominate
  select id, count(*) from public.quake_history group by id having count(*) > 1;  -- expect ZERO rows
  select max(to_timestamp(time/1000)) as newest from public.quake_history;  -- should track ~now
  ```

- [ ] **Step 4: Verify the function response.** Trigger the function (or read `cron.job_run_details`); its JSON should include `archived: <n>` and `sources: { phivolcs, usgs, emsc }`. A non-zero `archived` confirms the upsert path.

- [ ] **Step 5: Confirm national alert reach.** Confirm a subscriber location outside Southern Mindanao is now eligible: the fetch bbox is national, so a non-Mindanao M4.5+ within a subscriber's felt radius will push. (Spot-check against the next national M4.5+, or temporarily lower a test subscriber's distance.)

---

## Self-review notes

- **Spec coverage:** `quake_history` table with per-source rows + RLS public-read (Task 1); national M2.0+ fetch, archive upsert, national M4.5+ alerts by subscriber location, `archived` in response (Task 2); deploy + operational verification (Task 3). Write-only (no app read-back) and unchanged honest-framing copy are respected. Cron unchanged.
- **Decisions honored:** one row per source (lossless), keyed by source id; FETCH_MIN 2.0 vs ALERT_MIN 4.5; watermark tracks alert-eligible events only (prevents M2.0 archive traffic from suppressing a late M4.5); archive wrapped best-effort so it never blocks alerts; in-batch de-dup before upsert.
- **Type consistency:** `Q` (with `id`, `depthKm`) is used identically across all three fetchers, the archive mapper, and `sameQuake`. The table column `depth_km` maps from `q.depthKm`; `source` is stored lowercased to match the `'phivolcs'|'usgs'|'emsc'` convention.
- **No automated test surface:** verification is `deno check` + the operational checks in Task 3, consistent with the existing untested edge function. This is stated, not hidden.
