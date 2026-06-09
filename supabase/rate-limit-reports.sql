-- Server-side rate limiting for report creation (enforced even if the client-side
-- check is bypassed). Per-device AND per-IP limits. Run in the Supabase SQL editor.
-- The app already handles the resulting 'rate_limited' error gracefully.

-- Ephemeral hashed-IP buckets. We never store raw IPs, and rows self-expire.
create table if not exists public.rate_hits (
  bucket     text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_hits_idx on public.rate_hits (bucket, created_at);
alter table public.rate_hits enable row level security;
-- No anon policies: only the SECURITY DEFINER trigger below ever touches this table.

create or replace function public.reports_rate_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  n int;
  ip text;
  key text;
begin
  -- Per device: at most 6 reports per 5 minutes.
  if NEW.device_id is not null then
    select count(*) into n from public.reports
      where device_id = NEW.device_id and created_at > now() - interval '5 minutes';
    if n >= 6 then
      raise exception 'rate_limited' using errcode = 'check_violation';
    end if;
  end if;

  -- Per IP (hashed): at most 12 reports per 5 minutes. Catches device-id rotation.
  begin
    ip := nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for';
  exception when others then ip := null;
  end;

  if ip is not null and btrim(ip) <> '' then
    key := 'rep:' || md5(split_part(ip, ',', 1));      -- only a hash is stored
    select count(*) into n from public.rate_hits
      where bucket = key and created_at > now() - interval '5 minutes';
    if n >= 12 then
      raise exception 'rate_limited' using errcode = 'check_violation';
    end if;
    insert into public.rate_hits (bucket) values (key);
    delete from public.rate_hits where created_at < now() - interval '30 minutes';  -- housekeeping
  end if;

  return NEW;
end;
$$;

drop trigger if exists reports_rate_limit_trg on public.reports;
create trigger reports_rate_limit_trg
  before insert on public.reports
  for each row execute function public.reports_rate_limit();
