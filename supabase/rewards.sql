-- Phase 3: recognition. Optional nicknames + server-computed points (derived from real
-- verified actions, never client-asserted). Run in the Supabase SQL editor.

-- Optional nickname per device.
create table if not exists public.contributors (
  device_id  text primary key,
  nickname   text,
  updated_at timestamptz not null default now()
);
alter table public.contributors enable row level security;
-- No anon policies: only the SECURITY DEFINER functions below touch this.

create or replace function public.set_nickname(dev text, nick text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.contributors (device_id, nickname, updated_at)
  values (dev, nullif(btrim(nick), ''), now())
  on conflict (device_id) do update set nickname = excluded.nickname, updated_at = now();
end;
$$;
grant execute on function public.set_nickname(text, text) to anon, authenticated;

-- Scoring: +10 per authored report that is confirmed/resolved (verified by others),
--          +2 per confirmation given, +1 per resolve vote given, -15 per hidden report.
create or replace function public.my_stats(dev text)
returns json language sql security definer set search_path = public as $$
  with a as (
    select
      count(*) filter (where state in ('confirmed','resolved')) as verified,
      count(*) filter (where status = 'hidden') as hidden,
      count(*) as total
    from public.reports where device_id = dev
  ),
  g as (
    select
      (select count(*) from public.report_confirms where device_id = dev) as confirms,
      (select count(*) from public.report_resolves where device_id = dev) as resolves
  )
  select json_build_object(
    'verifiedReports', a.verified,
    'totalReports', a.total,
    'confirmsGiven', g.confirms,
    'resolvesGiven', g.resolves,
    'points', greatest(0, a.verified*10 + g.confirms*2 + g.resolves*1 - a.hidden*15)
  ) from a, g;
$$;
grant execute on function public.my_stats(text) to anon, authenticated;

-- Top contributors by points, with nickname (no device_id exposed).
create or replace function public.leaderboard(lim int default 10)
returns table(nickname text, points int, verified_reports int)
language sql security definer set search_path = public as $$
  with per_device as (
    select d.device_id,
      coalesce(r.verified,0)*10 + coalesce(c.cnt,0)*2 + coalesce(rv.cnt,0)*1 - coalesce(r.hidden,0)*15 as pts,
      coalesce(r.verified,0) as verified
    from (
      select device_id from public.reports
      union select device_id from public.report_confirms
      union select device_id from public.report_resolves
    ) d
    left join (
      select device_id,
        count(*) filter (where state in ('confirmed','resolved')) as verified,
        count(*) filter (where status='hidden') as hidden
      from public.reports group by device_id
    ) r on r.device_id = d.device_id
    left join (select device_id, count(*) cnt from public.report_confirms group by device_id) c on c.device_id = d.device_id
    left join (select device_id, count(*) cnt from public.report_resolves group by device_id) rv on rv.device_id = d.device_id
  )
  select coalesce(nullif(btrim(co.nickname),''), 'Anonymous') as nickname,
         greatest(0, pd.pts)::int as points,
         pd.verified::int as verified_reports
  from per_device pd
  left join public.contributors co on co.device_id = pd.device_id
  where greatest(0, pd.pts) > 0
  order by points desc
  limit lim;
$$;
grant execute on function public.leaderboard(int) to anon, authenticated;
