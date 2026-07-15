-- ====================================================================
-- Credora migration 011: verified badge
-- Run in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- ====================================================================

alter table public.profiles add column if not exists is_verified boolean not null default false;

-- Grant it to your own account. There's no in-app moderator UI for this
-- yet — verifying anyone else is a manual UPDATE in the dashboard, same as
-- reviewing reports (see migration 007).
update public.profiles set is_verified = true where username = 'collins.ugwu';
