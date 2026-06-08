-- LINDÓL reports schema. Run in Supabase SQL editor.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('damage','road','fire','help','safe','other')),
  note text not null default '' check (char_length(note) <= 280),
  lat float8 not null,
  lng float8 not null,
  photo_url text,
  status text not null default 'visible' check (status in ('visible','hidden')),
  flag_count int not null default 0
);
create index if not exists reports_created_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

create policy "read visible" on public.reports
  for select to anon using (status = 'visible');
create policy "admin read all" on public.reports
  for select to authenticated using (true);
create policy "public insert" on public.reports
  for insert to anon with check (status = 'visible' and flag_count = 0);
create policy "admin update" on public.reports
  for update to authenticated using (true) with check (true);
create policy "admin delete" on public.reports
  for delete to authenticated using (true);

create or replace function public.flag_report(rid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.reports
     set flag_count = flag_count + 1,
         status = case when flag_count + 1 >= 3 then 'hidden' else status end
   where id = rid and status = 'visible';
end; $$;
grant execute on function public.flag_report(uuid) to anon, authenticated;

alter publication supabase_realtime add table public.reports;
