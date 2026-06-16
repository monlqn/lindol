-- Command-center tier access: an allowlist of authorized agency accounts (e.g. PDRRMO), keyed by
-- the email they sign in with. Gates the Mapbox command map + responder routing. The public app
-- never touches this. Authorize someone by inserting their email AFTER they have a Supabase auth
-- account (created in the dashboard or by sign-up).
create table if not exists public.command_access (
  email text primary key,
  role text not null default 'responder',     -- 'responder' | 'pdrrmo' | 'admin'
  org text,                                    -- e.g. 'PDRRMO South Cotabato'
  created_at timestamptz not null default now()
);

alter table public.command_access enable row level security;
-- A signed-in user may read ONLY their own access row (so the app can check their role). Granting
-- access is done here in SQL (or the dashboard), never from the client.
drop policy if exists "read own command access" on public.command_access;
create policy "read own command access" on public.command_access
  for select to authenticated using (email = auth.email());

-- Authorize accounts (example - replace with the real agency emails):
-- insert into public.command_access (email, role, org)
--   values ('ops@pdrrmo.southcotabato.gov.ph', 'pdrrmo', 'PDRRMO South Cotabato')
--   on conflict (email) do update set role = excluded.role, org = excluded.org;
