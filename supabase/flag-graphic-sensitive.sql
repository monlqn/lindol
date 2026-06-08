-- Only blur photos that someone flags as "graphic", instead of blurring every photo.
-- Run in the Supabase SQL editor (after flag-reasons.sql).

-- 1) A per-report flag the feed can read (reports are publicly selectable).
alter table public.reports add column if not exists sensitive boolean not null default false;

-- 2) flag_report marks a report sensitive the moment it's flagged as "graphic".
create or replace function public.flag_report(rid uuid, dev text, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  insert into public.report_flags (report_id, device_id, reason)
  values (rid, dev, reason)
  on conflict (report_id, device_id) do nothing;

  select count(*) into n from public.report_flags where report_id = rid;

  update public.reports
     set flag_count = n,
         status = case when n >= 5 then 'hidden' else status end,
         sensitive = case when reason = 'graphic' then true else sensitive end
   where id = rid;
end;
$$;
grant execute on function public.flag_report(uuid, text, text) to anon, authenticated;
