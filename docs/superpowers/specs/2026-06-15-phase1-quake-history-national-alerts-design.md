# Phase 1: Durable quake history + national location-based alerts (design)

Date: 2026-06-15
Status: approved for planning

## Why this exists

Phase 0 froze week-1 PHIVOLCS data into a committed snapshot. But PHIVOLCS has no archive, so every day after the snapshot, more perishable records age off the live bulletin and are lost forever. Phase 1 makes preservation continuous: a server-side capture writes every quake it sees into a durable Supabase table, starting now.

While doing this we also fix a gap exposed by Phase 0's national reframing: the background **push** alerts only fetch a Southern-Mindanao bbox (lat 4.5 to 9.5, lng 124 to 128), so a subscriber in Luzon or the Visayas who enables push gets no alert for a significant quake near them, even though the in-app alarm is already national. The same broadened national fetch serves both the archive and the alert fix, so they ship together.

## Goals

- Durably accumulate the full national M2.0+ quake catalog (especially perishable PHIVOLCS records) from now on.
- Make background push alerts national and location-based: alert any subscriber for a significant quake near them, anywhere in the Philippines.
- Stay cheap and polite (CDN-cached PHIVOLCS, within Supabase free tier).
- Keep the honest framing: background push is after-the-fact awareness (~1 to 6 min), never early warning.

## Non-goals (deferred)

- The app reading `quake_history` back into its feed or UI (Phase 2/3). Phase 1 is write-only capture.
- A persistent EMSC-WebSocket to web-push bridge for near-instant background alerts (option B, a possible later phase). Its benefit is still capped by provider detection lag, and the in-app WebSocket alarm already covers the seconds-latency case when the app is open.
- Retention/pruning of `quake_history`. We want the full history; the table grows only ~20 to 30 MB/year.

## Design

### 1. New table: `quake_history`

A faithful, lossless archive: **one row per source report**, keyed by that source's own stable id. The same physical event reported by PHIVOLCS, USGS, and EMSC becomes up to three rows. De-duplication into one logical event is a read-time concern handled later by the existing `mergeQuakes` (the app already merges three sources this way), so the writer stays trivial and nothing is fabricated or collapsed at write time.

Migration SQL in a new file `supabase/quake-history.sql` (run once in the SQL editor, same pattern as the other `supabase/*.sql` files):

```
quake_history(
  id          text primary key,        -- source-specific stable id (phivolcs:.. / usgs id / emsc:..)
  source      text not null,           -- 'phivolcs' | 'usgs' | 'emsc'
  mag         double precision not null,
  place       text,
  time        bigint not null,         -- epoch ms (matches the app's Quake shape)
  lat         double precision not null,
  lng         double precision not null,
  depth_km    double precision,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
)
index on (time desc)                   -- for future range queries
```

- **RLS:** enabled. A public `select` policy (anon read-only) so the app can read history in a later phase. No insert/update policy for anon, so only the `service_role` cron can write (service_role bypasses RLS).
- **Upsert semantics:** `on conflict (id) do update set mag, place, time, lat, lng, depth_km, last_seen = now()` (refresh values and `last_seen`; preserve `first_seen`). Idempotent: re-fetching the same event every minute updates in place, never duplicates.
- Per-source stable ids avoid the duplicate-row hazard a "merged winning id" key would have (the winning source can change run to run when one source is briefly down).

### 2. Refactor the `alerts` edge function into capture + national alerts

Keep the function name `alerts` and the existing cron (`poll-aftershocks`, every minute) to avoid disrupting the deployed URL, secrets, and schedule. Broaden what it does. One national fetch per run feeds both outputs.

Constants change:
- `BBOX` becomes national: `minlatitude=4.5&maxlatitude=21.5&minlongitude=116&maxlongitude=127` (matches `REGION.bbox`).
- Split the magnitude threshold: `FETCH_MIN = 2.0` (what we archive) and `ALERT_MIN = 4.5` (what we push). The alert threshold and felt-radius logic are unchanged.
- Archive look-back window: PHIVOLCS via `/api/phivolcs?days=1&min=2.0`; USGS and EMSC `starttime` = last 24h, `minmagnitude=2.0`, national bbox. The 24h window (re-fetched each run, upserted) makes capture self-healing if a run fails; volume stays tiny (USGS/EMSC national M2.0+ is roughly 0 to 3/day; PHIVOLCS is the only real volume and is CDN-cached).

Per-run steps:
1. Fetch PHIVOLCS, USGS, EMSC at national bbox, M2.0+ (independent try/catch each, as today, so one source failing never aborts capture).
2. **Archive:** upsert each source's raw parsed events into `quake_history` (one batched `upsert` per source).
3. **Merge** the three (PHIVOLCS-first, `sameQuake` dedup) using the existing in-function merge.
4. **Alert:** from the merged set, take events newer than the `alert_state` watermark with `mag >= ALERT_MIN`; for each subscriber, send web-push only if within `feltRadiusKm(mag)` of their stored location (national now, since the fetch is national). Advance the watermark and prune dead subscriptions exactly as today.
5. Return JSON including per-source counts and an `archived` count (mirrors the existing verifiable-at-a-glance response).

The watermark (`alert_state.last_quake_time`) governs alerts only; the archive has no watermark (idempotent upsert over a rolling window).

### 3. Cron

Unchanged: `poll-aftershocks` every minute. No new schedule. The archive piggybacks the same run.

## Data flow

```
pg_cron (every 1 min)
   -> alerts edge function
        fetch national M2.0+  (PHIVOLCS via cached proxy, USGS, EMSC)
          |-> upsert raw per-source rows -> quake_history   (archive, write-only)
          |-> merge -> fresh M4.5+ by watermark -> per-subscriber felt-radius push  (national alerts)
```

## Error handling and resilience

- Each source fetch is independently guarded; a source being down degrades coverage for that run but never aborts the function (archive upsert still runs for the sources that returned).
- Upsert is idempotent, so a retried or overlapping run cannot create duplicates.
- Archive failure must not block alerts and vice versa (independent try/catch around the upsert and the push loop).
- Secrets/auth unchanged: only the cron's `service_role` bearer may trigger the function.

## Testing and verification

The edge function is Deno and currently has no unit tests (consistent with the existing codebase). Verification is operational:
- After deploy + running `supabase/quake-history.sql`: confirm rows accrue with `select source, count(*) from quake_history group by source;` and that re-runs do not duplicate (`select id, count(*) from quake_history group by id having count(*) > 1;` returns nothing).
- The function's JSON response reports `{ archived, sources: { phivolcs, usgs, emsc }, sent }` for at-a-glance verification.
- National alert path: confirm a subscriber location outside Mindanao would be considered (manual check against a recent non-Mindanao M4.5+, or a one-off test row).
- Honest-framing copy on the push payload is unchanged.

## Deployment

1. Run `supabase/quake-history.sql` once in the Supabase SQL editor.
2. Redeploy the `alerts` function (via the Supabase dashboard, per the known CLI Deno-parse issue noted in project infra).
3. No cron change needed. Watch `cron.job_run_details` and the function response to confirm capture + national alerts.
