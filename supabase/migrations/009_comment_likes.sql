-- ====================================================================
-- Credora migration 009: comment likes
-- Lets a post's author (or anyone) like a comment, same pattern as
-- liking a post. Run in Supabase: SQL Editor -> New query -> paste this
-- whole file -> Run.
-- ====================================================================

create table public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.comment_likes enable row level security;

create policy "Comment likes are viewable by everyone"
  on public.comment_likes for select using (true);

create policy "Users can like comments"
  on public.comment_likes for insert with check (auth.uid() = user_id);

create policy "Users can remove their own comment likes"
  on public.comment_likes for delete using (auth.uid() = user_id);
