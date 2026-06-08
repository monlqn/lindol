-- CONSOLIDATED FIX. Run this once in the Supabase SQL editor.
-- The report_flags.reason column was never added (flag-reasons.sql wasn't applied),
-- which broke the graphic-sensitive flag_report. This adds the column + admin read
-- policy and installs the final flag_report (stores reason + marks graphic sensitive).
-- Supersedes flag-reasons.sql and flag-graphic-sensitive.sql.

-- 1) The missing column.
alter table public.report_flags add column if not exists reason text;

-- 2) Let the signed-in admin read flag rows (for the reason breakdown).
drop policy if exists "authenticated read report_flags" on public.report_flags;
create policy "authenticated read report_flags"
  on public.report_flags for select to authenticated using (true);

-- 3) The final flag_report: one flag per device, auto-hide at 5, store the reason,
--    and auto-blur the photo when flagged as "graphic".
create or replace function public.flag_report(rid uuid, dev text, reason text)
returns void
language plpgsql security definer set search_path = public
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
