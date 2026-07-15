-- ====================================================================
-- Credora migration 013: edit posts, quote-reshare, mute
-- Run in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- ====================================================================

-- Editing a post: posts.sql never granted an UPDATE policy, only insert
-- and delete, so this was outright rejected by RLS before now.
create policy "Users can edit their own posts"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- Quote-reshare: an optional comment attached to a reshare, distinct from
-- a plain repost.
alter table public.reshares add column if not exists quote_text text check (char_length(quote_text) <= 500);

-- Mute: hides someone's posts from your own feed, silently — unlike a
-- block, it's one-directional and doesn't touch messaging at all.
create table public.mutes (
  muter_id uuid not null references public.profiles (id) on delete cascade,
  muted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  constraint no_self_mute check (muter_id <> muted_id)
);

alter table public.mutes enable row level security;

create policy "Users can see their own mutes"
  on public.mutes for select
  using (auth.uid() = muter_id);

create policy "Users can mute others"
  on public.mutes for insert
  with check (auth.uid() = muter_id);

create policy "Users can unmute"
  on public.mutes for delete
  using (auth.uid() = muter_id);
