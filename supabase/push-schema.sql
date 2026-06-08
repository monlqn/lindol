create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "anon subscribe" on public.push_subscriptions
  for insert to anon with check (true);
create policy "anon update own" on public.push_subscriptions
  for update to anon using (true) with check (true);

create table if not exists public.alert_state (
  id int primary key default 1,
  last_quake_time bigint not null default 0
);
insert into public.alert_state (id, last_quake_time) values (1, 0) on conflict do nothing;
