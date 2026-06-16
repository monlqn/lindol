create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
-- Idempotent: drop-then-create so the whole file is safe to re-run.
drop policy if exists "anon subscribe" on public.push_subscriptions;
create policy "anon subscribe" on public.push_subscriptions
  for insert to anon with check (true);
drop policy if exists "anon update own" on public.push_subscriptions;
create policy "anon update own" on public.push_subscriptions
  for update to anon using (true) with check (true);

create table if not exists public.alert_state (
  id int primary key default 1,
  last_quake_time bigint not null default 0,
  -- Ids already pushed (most recent ~300), so a quake revised up past the alert threshold within the
  -- grace window isn't re-pushed and isn't suppressed by the time watermark alone.
  pushed_ids jsonb not null default '[]'::jsonb
);
insert into public.alert_state (id, last_quake_time) values (1, 0) on conflict do nothing;
-- Migration for existing deployments:
alter table public.alert_state add column if not exists pushed_ids jsonb not null default '[]'::jsonb;
