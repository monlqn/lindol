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
