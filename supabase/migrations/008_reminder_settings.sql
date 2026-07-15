-- ====================================================================
-- Credora migration 008: reminder enable/disable flags + personal
-- prayer intention reminders
-- Run in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- ====================================================================

-- Whether each liturgical reminder is actively scheduled. Previously the
-- toggle on each prayer card marked today's prayer as done; this column
-- separates that from "should this fire a reminder at all", which is what
-- the toggle now controls. Times themselves live in profiles.reminder_times
-- (added in migration 006) — Divine Mercy is deliberately absent from that
-- times object since its 3am/3pm schedule is fixed, not user-editable.
alter table public.profiles add column if not exists reminders_enabled jsonb not null default '{"morning":false,"angelus":false,"rosary":false,"mercy":false,"evening":false}';

alter table public.prayer_intentions add column if not exists reminder_time text;
alter table public.prayer_intentions add column if not exists reminder_enabled boolean not null default false;
