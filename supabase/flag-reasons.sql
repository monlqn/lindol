-- Flag reasons: capture WHY a report was flagged, and let the admin read the breakdown.
-- Run in the Supabase SQL editor AFTER flag-dedup.sql.

-- 1) Store a reason on each flag.
alter table public.report_flags add column if not exists reason text;

-- 2) 3-arg flag_report that records the reason (keeps the dedup + auto-hide at 5).
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
         status = case when n >= 5 then 'hidden' else status end
   where id = rid;
end;
$$;
grant execute on function public.flag_report(uuid, text, text) to anon, authenticated;

-- 3) Let the signed-in admin read flag rows (anon still cannot — no anon policy).
drop policy if exists "authenticated read report_flags" on public.report_flags;
create policy "authenticated read report_flags"
  on public.report_flags for select to authenticated using (true);
