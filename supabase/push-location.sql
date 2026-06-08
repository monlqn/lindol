-- Store each push subscriber's location so alerts can be scoped to quakes near them.
-- Run in the Supabase SQL editor, then redeploy the `alerts` Edge Function.
alter table public.push_subscriptions add column if not exists lat double precision;
alter table public.push_subscriptions add column if not exists lng double precision;
