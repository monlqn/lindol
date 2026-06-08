-- "Report to authorities": mark a report as escalated so others don't duplicate the call.
-- Run in the Supabase SQL editor.

alter table public.reports add column if not exists escalated boolean not null default false;

create or replace function public.escalate_report(rid uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.reports set escalated = true where id = rid;
end;
$$;
grant execute on function public.escalate_report(uuid) to anon, authenticated;
