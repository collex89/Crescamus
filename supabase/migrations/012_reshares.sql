-- ====================================================================
-- Credora migration 012: reshares (repost)
-- Run in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- ====================================================================

create table public.reshares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index reshares_user_id_idx on public.reshares (user_id, created_at desc);
create index reshares_post_id_idx on public.reshares (post_id);

alter table public.reshares enable row level security;

create policy "Reshares are viewable by everyone"
  on public.reshares for select using (true);

create policy "Users can reshare posts"
  on public.reshares for insert with check (auth.uid() = user_id);

create policy "Users can remove their own reshares"
  on public.reshares for delete using (auth.uid() = user_id);
