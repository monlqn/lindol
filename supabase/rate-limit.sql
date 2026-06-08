-- Per-device report rate limit (server-side backstop). Run once in the SQL editor.
alter table public.reports add column if not exists device_id text;

create or replace function public.reports_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  if NEW.device_id is not null then
    select count(*) into cnt from public.reports
      where device_id = NEW.device_id and created_at > now() - interval '5 minutes';
    if cnt >= 12 then
      raise exception 'rate_limited: too many reports from this device, please wait a few minutes';
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists reports_rate_limit_trg on public.reports;
create trigger reports_rate_limit_trg before insert on public.reports
  for each row execute function public.reports_rate_limit();
