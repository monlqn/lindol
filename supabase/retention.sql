-- LINDOL 14-day photo retention. Run ONCE in the Supabase SQL editor.
-- Deletes report PHOTOS older than 14 days (keeps the text+location report) to bound storage.
create extension if not exists pg_cron;
select cron.schedule(
  'purge-old-report-photos',
  '0 18 * * *',  -- daily 18:00 UTC (~02:00 PH)
  $$
    delete from storage.objects
      where bucket_id = 'report-photos' and created_at < now() - interval '14 days';
    update public.reports
      set photo_url = null
      where photo_url is not null and created_at < now() - interval '14 days';
  $$
);
