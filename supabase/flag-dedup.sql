-- Flagging: one device = one flag, and a higher auto-hide threshold.
-- Run this in the Supabase SQL editor BEFORE deploying the matching client build.

-- 1) Track who flagged what, so a single person can't flag the same report twice.
create table if not exists public.report_flags (
  report_id  uuid not null,
  device_id  text not null,
  created_at timestamptz not null default now(),
  primary key (report_id, device_id)
);
alter table public.report_flags enable row level security;
-- No anon policies on purpose: only the SECURITY DEFINER function below writes here,
-- so the public key can never insert/read raw flag rows.

-- 2) Deduped flag. flag_count becomes the number of DISTINCT devices that flagged.
--    Auto-hide once 5 different devices have flagged it.
create or replace function public.flag_report(rid uuid, dev text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  insert into public.report_flags (report_id, device_id)
  values (rid, dev)
  on conflict (report_id, device_id) do nothing;

  select count(*) into n from public.report_flags where report_id = rid;

  update public.reports
     set flag_count = n,
         status = case when n >= 5 then 'hidden' else status end
   where id = rid;
end;
$$;
grant execute on function public.flag_report(uuid, text) to anon, authenticated;

-- 3) Keep the old single-arg version working for any not-yet-updated clients,
--    but bump its threshold to 5 too (no dedup — it phases out as installs update).
create or replace function public.flag_report(rid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reports
     set flag_count = flag_count + 1,
         status = case when flag_count + 1 >= 5 then 'hidden' else status end
   where id = rid and status = 'visible';
end;
$$;
grant execute on function public.flag_report(uuid) to anon, authenticated;
