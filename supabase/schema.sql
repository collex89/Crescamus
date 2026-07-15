-- ====================================================================
-- Credora database schema
-- Run this once in your Supabase project: SQL Editor -> New query ->
-- paste the whole file -> Run.
-- ====================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------
-- PROFILES (one row per user; username is UNIQUE = one per person)
-- --------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  parish text not null default '',
  bio text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9._]{3,20}$')
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile when a user signs up. Username comes from the
-- signup metadata; for OAuth users (Google/Apple) one is generated from
-- their email and de-duplicated with a numeric suffix.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  base := lower(coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  ));
  base := regexp_replace(base, '[^a-z0-9._]+', '.', 'g');
  base := trim(both '.' from base);
  if length(base) < 3 then
    base := 'pilgrim';
  end if;
  base := left(base, 20);

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := left(base, 20 - length(n::text)) || n::text;
  end loop;

  insert into public.profiles (id, username, full_name, parish, avatar_url)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'parish', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------
-- POSTS
-- --------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  image_url text,
  video_url text,
  created_at timestamptz not null default now()
);

create index posts_created_at_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

create policy "Posts are viewable by everyone"
  on public.posts for select using (true);

create policy "Users can create their own posts"
  on public.posts for insert with check (auth.uid() = author_id);

create policy "Users can delete their own posts"
  on public.posts for delete using (auth.uid() = author_id);

-- --------------------------------------------------------------------
-- LIKES
-- --------------------------------------------------------------------
create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.likes enable row level security;

create policy "Likes are viewable by everyone"
  on public.likes for select using (true);

create policy "Users can like posts"
  on public.likes for insert with check (auth.uid() = user_id);

create policy "Users can remove their own likes"
  on public.likes for delete using (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- COMMENTS
-- --------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index comments_post_id_idx on public.comments (post_id);

alter table public.comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.comments for select using (true);

create policy "Users can comment"
  on public.comments for insert with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on public.comments for delete using (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- FOLLOWS
-- --------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;

create policy "Follows are viewable by everyone"
  on public.follows for select using (true);

create policy "Users can follow others"
  on public.follows for insert with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.follows for delete using (auth.uid() = follower_id);

-- --------------------------------------------------------------------
-- BOOKMARKS (private to each user)
-- --------------------------------------------------------------------
create table public.bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.bookmarks enable row level security;

create policy "Users can view their own bookmarks"
  on public.bookmarks for select using (auth.uid() = user_id);

create policy "Users can bookmark posts"
  on public.bookmarks for insert with check (auth.uid() = user_id);

create policy "Users can remove their own bookmarks"
  on public.bookmarks for delete using (auth.uid() = user_id);
