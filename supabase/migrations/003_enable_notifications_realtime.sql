-- ====================================================================
-- Credora migration 003: enable live delivery for notifications
-- Creating a table's RLS policies is not enough for Supabase Realtime's
-- postgres_changes to fire on it — the table also has to be added to the
-- supabase_realtime publication. Run this once: SQL Editor -> New query
-- -> paste -> Run.
-- ====================================================================

alter publication supabase_realtime add table public.notifications;
