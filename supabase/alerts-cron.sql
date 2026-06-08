create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'poll-aftershocks',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://<PROJECT-REF>.functions.supabase.co/alerts',
      headers := jsonb_build_object('Authorization', 'Bearer <ANON_OR_FUNCTION_TOKEN>')
    );
  $$
);
