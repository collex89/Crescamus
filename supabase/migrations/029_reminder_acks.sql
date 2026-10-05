-- ====================================================================
-- Crescamus migration 029: stop prayer-reminder re-alerts once answered
-- Run in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- ====================================================================
--
-- Prayer reminders now re-alert at +1 and +2 minutes when the app is closed
-- (see send-reminder-pushes). When the user taps or dismisses one, the
-- service worker calls the ack-reminder Edge Function, which records it
-- here so the remaining re-alerts for that reminder are skipped.
--
-- tag is "rem:<reminder key>:<local date>", one per reminder per day.
-- Only Edge Functions (service role) touch this table, so RLS is on with no
-- policies: no client can read or write it directly. Rows older than two
-- days are cleared automatically by send-reminder-pushes.
create table if not exists public.reminder_acks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, tag)
);

create index if not exists reminder_acks_created_at_idx on public.reminder_acks (created_at);

alter table public.reminder_acks enable row level security;
