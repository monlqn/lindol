-- Community comments on "Need help" (SOS) reports + owner add-photo. Run once in the SQL editor.

-- ---------- comments table ----------
create table if not exists report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  device_id text not null,
  nickname text,
  body text not null,
  flag_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_report_comments_report on report_comments(report_id, created_at);

alter table report_comments enable row level security;
-- Read public columns only - never expose device_id.
revoke select on report_comments from anon;
grant select (id, report_id, nickname, body, flag_count, created_at) on report_comments to anon;
drop policy if exists read_comments on report_comments;
create policy read_comments on report_comments for select to anon using (true);

-- ---------- add a comment ----------
-- On any report, blocked once the report is resolved, rate-limited (8 / device / 5 min).
create or replace function add_report_comment(p_report_id uuid, p_device_id text, p_body text, p_nickname text)
returns table(id uuid, report_id uuid, nickname text, body text, flag_count int, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare r_state text;
begin
  if p_body is null or length(trim(p_body)) = 0 or length(p_body) > 280 then
    raise exception 'invalid_comment';
  end if;
  select state into r_state from reports where reports.id = p_report_id;
  if not found then raise exception 'no_report'; end if;
  if r_state = 'resolved' then raise exception 'resolved'; end if;
  if (select count(*) from report_comments c
        where c.device_id = p_device_id and c.created_at > now() - interval '5 minutes') >= 8 then
    raise exception 'rate_limited';
  end if;
  return query
    insert into report_comments(report_id, device_id, nickname, body)
    values (p_report_id, p_device_id, nullif(trim(p_nickname), ''), trim(p_body))
    returning report_comments.id, report_comments.report_id, report_comments.nickname,
              report_comments.body, report_comments.flag_count, report_comments.created_at;
end $$;
grant execute on function add_report_comment(uuid, text, text, text) to anon;

-- ---------- flag a comment (one flag per device, server-enforced) ----------
-- Mirrors report_flags: without dedup a single caller could loop flag_comment and
-- silently erase any comment (client hides at flag_count >= 3).
create table if not exists comment_flags (
  comment_id uuid not null references report_comments(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, device_id)
);
alter table comment_flags enable row level security;
-- No anon policies on purpose: only the SECURITY DEFINER function below writes here.

create or replace function flag_comment(p_comment_id uuid, p_device_id text)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_device_id is null or length(trim(p_device_id)) = 0 then
    raise exception 'invalid_device';
  end if;
  insert into comment_flags(comment_id, device_id)
  values (p_comment_id, trim(p_device_id))
  on conflict (comment_id, device_id) do nothing;
  select count(*) into n from comment_flags where comment_id = p_comment_id;
  update report_comments set flag_count = n where id = p_comment_id;
end $$;
grant execute on function flag_comment(uuid, text) to anon;

-- Remove the old 1-arg version (no dedup, unlimited increments).
drop function if exists flag_comment(uuid);

-- ---------- owner adds/updates a photo on their own report ----------
create or replace function update_report_photo(p_report_id uuid, p_device_id text, p_photo_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Only our own Storage bucket: the URL ends up in the /r/:id share page's og:image,
  -- so an arbitrary value would let a report owner plant attacker-controlled image URLs.
  if p_photo_url is null or p_photo_url not like
     'https://mhlewtduywpspiahuhfa.supabase.co/storage/v1/object/public/report-photos/%' then
    raise exception 'invalid_url';
  end if;
  update reports set photo_url = p_photo_url
  where id = p_report_id and device_id = p_device_id;
  if not found then raise exception 'not_owner'; end if;
end $$;
grant execute on function update_report_photo(uuid, text, text) to anon;
