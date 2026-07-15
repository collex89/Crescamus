-- ====================================================================
-- Credora migration 014: post videos
-- Run in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- Reuses the existing "post-images" storage bucket and its RLS policies
-- (migration 004) — they're scoped by path, not file type, so video
-- uploads under the same <user_id>/<file> path are already covered.
-- ====================================================================

alter table public.posts add column if not exists video_url text;
