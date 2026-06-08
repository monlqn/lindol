-- Community resolve: neighbours can also vote a report resolved (for when the original
-- reporter goes silent). 3 distinct devices -> resolved. The reporter's own instant
-- resolve (set_report_resolved) still works as before. Run in the Supabase SQL editor.

alter table public.reports add column if not exists resolve_count int not null default 0;

create table if not exists public.report_resolves (
  report_id  uuid not null,
  device_id  text not null,
  created_at timestamptz not null default now(),
  primary key (report_id, device_id)
);
alter table public.report_resolves enable row level security;
-- No anon policies: only the SECURITY DEFINER function below writes here.

create or replace function public.vote_resolve(rid uuid, dev text)
returns void
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  insert into public.report_resolves (report_id, device_id)
  values (rid, dev)
  on conflict (report_id, device_id) do nothing;

  select count(*) into n from public.report_resolves where report_id = rid;

  update public.reports
     set resolve_count = n,
         state = case when n >= 3 then 'resolved' else state end
   where id = rid;
end;
$$;
grant execute on function public.vote_resolve(uuid, text) to anon, authenticated;
