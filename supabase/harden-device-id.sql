-- ⚠️ Run this ONLY AFTER the matching frontend deploy is live.
-- The app must already be selecting explicit columns (not SELECT *); otherwise the
-- live feed will break. This hides device_id from the anonymous API so no one can
-- harvest other people's device IDs, and clears leftover verification test rows.

-- 1) Remove device_id from what the anon role can read.
revoke select (device_id) on public.reports from anon;

-- 2) Clean up the "__verify__" test data so it doesn't pollute the leaderboard/counts.
delete from public.report_flags    where device_id = '__verify__';
delete from public.report_confirms where device_id = '__verify__';
delete from public.report_resolves where device_id = '__verify__';
delete from public.contributors    where device_id = '__verify__';
