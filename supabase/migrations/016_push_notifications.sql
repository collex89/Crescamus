-- ====================================================================
-- Crescamus migration 016: background push notifications
-- Run in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
--
-- Before running this, store the cron shared secret in Vault (SQL Editor,
-- separately, NOT part of this migration since it's a real secret):
--   select vault.create_secret('<the CRON_SECRET value>', 'cron_secret');
-- That value must match the CRON_SECRET Edge Function secret (already set
-- via `supabase secrets set`). It authenticates the scheduled call below so
-- the send-reminder-pushes function can't be triggered by anyone who finds
-- the URL.
-- ====================================================================

-- Needed so the server can compute "is it 6am right now for this specific
-- user" -- reminders are stored as plain HH:MM with no timezone attached,
-- because until now everything fired client-side against the device's own
-- clock. A scheduled job has no device to ask, so it needs this instead.
alter table public.profiles add column if not exists timezone text;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Users can view their own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can add their own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Runs every minute; calls the send-reminder-pushes Edge Function, which
-- checks every profile's local time against their enabled reminders and
-- sends a real Web Push message for any that are due right now. This is
-- what makes reminders fire even with the app fully closed -- previously
-- they only fired while a tab was open running the JS interval in
-- reminders.js (that scheduler is unchanged and still runs too, for the
-- richer in-app experience -- alarm tone, no round-trip -- when the app
-- is open; the service worker's push handler skips showing a duplicate
-- notification when it detects the app is already open for exactly this
-- reason).
select cron.schedule(
  'send-reminder-pushes',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://dvhiurxvasyytoogixhr.supabase.co/functions/v1/send-reminder-pushes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
