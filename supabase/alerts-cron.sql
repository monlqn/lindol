-- Runs the `alerts` Edge Function every minute so background push notifications fire even
-- when the app is closed. Run this ONCE in the Supabase SQL editor.
--
-- Before running: replace <SERVICE_ROLE_KEY> below with your project's service_role key
-- (Project Settings -> API -> service_role). It is a secret: paste it here in the SQL editor
-- only - never commit it to git. It is stored server-side in the cron job definition.
--
-- Prerequisites (one-time):
--   1) Deploy the function:        supabase functions deploy alerts
--   2) Set its secrets:            supabase secrets set SB_URL=... SB_SERVICE_KEY=... \
--                                    VAPID_PUBLIC=... VAPID_PRIVATE=... VAPID_SUBJECT=mailto:hello@lindol.app
--   3) Run this file.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running is safe: replace any existing job of the same name.
select cron.unschedule('poll-aftershocks')
where exists (select 1 from cron.job where jobname = 'poll-aftershocks');

select cron.schedule(
  'poll-aftershocks',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://mhlewtduywpspiahuhfa.supabase.co/functions/v1/alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      )
    );
  $$
);

-- Verify it registered:           select * from cron.job where jobname = 'poll-aftershocks';
-- See recent runs (success/fail):  select * from cron.job_run_details order by start_time desc limit 10;
