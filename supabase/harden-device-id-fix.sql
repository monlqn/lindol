-- FIX for harden-device-id.sql: the previous `revoke select (device_id)` was a no-op
-- because the anon role still held a TABLE-WIDE select grant. The correct way to hide a
-- column is to drop the table-wide grant and re-grant SELECT on only the safe columns.
-- (The app already selects exactly these columns, and authenticated/admin is untouched.)

revoke select on public.reports from anon;

grant select (
  id, created_at, category, note, lat, lng, photo_url,
  status, flag_count, sensitive, state, confirm_count, resolve_count, escalated
) on public.reports to anon;
