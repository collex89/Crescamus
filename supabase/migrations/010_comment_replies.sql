-- ====================================================================
-- Credora migration 010: reply to a comment (one level of nesting)
-- Run in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- ====================================================================

alter table public.comments
  add column if not exists parent_comment_id uuid references public.comments (id) on delete cascade;

create index if not exists comments_parent_comment_id_idx on public.comments (parent_comment_id);
