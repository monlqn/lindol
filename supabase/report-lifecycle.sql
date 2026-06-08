-- Report lifecycle: Open -> Confirmed (neighbours verify) -> Resolved (reporter closes).
-- Run in the Supabase SQL editor.

alter table public.reports add column if not exists state text not null default 'open';
alter table public.reports add column if not exists confirm_count int not null default 0;

-- One confirmation per device.
create table if not exists public.report_confirms (
  report_id  uuid not null,
  device_id  text not null,
  created_at timestamptz not null default now(),
  primary key (report_id, device_id)
);
alter table public.report_confirms enable row level security;
-- No anon policies: only the SECURITY DEFINER function below writes here.

-- Confirm a report. 3 distinct devices -> 'confirmed' (unless already resolved).
create or replace function public.confirm_report(rid uuid, dev text)
returns void
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  insert into public.report_confirms (report_id, device_id)
  values (rid, dev)
  on conflict (report_id, device_id) do nothing;

  select count(*) into n from public.report_confirms where report_id = rid;

  update public.reports
     set confirm_count = n,
         state = case when state = 'open' and n >= 3 then 'confirmed' else state end
   where id = rid;
end;
$$;
grant execute on function public.confirm_report(uuid, text) to anon, authenticated;

-- Only the reporter's own device can resolve or reopen their report.
create or replace function public.set_report_resolved(rid uuid, dev text, resolved boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.reports
     set state = case
                   when resolved then 'resolved'
                   when confirm_count >= 3 then 'confirmed'
                   else 'open'
                 end
   where id = rid and device_id = dev;
end;
$$;
grant execute on function public.set_report_resolved(uuid, text, boolean) to anon, authenticated;
