-- ====================================================================
-- Credora migration 007: moderation (reports + blocks)
-- Run in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- ====================================================================

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete cascade,
  reported_post_id uuid references public.posts (id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'misinformation', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint report_has_target check (reported_user_id is not null or reported_post_id is not null)
);

create index reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

create policy "Users can file reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "Users can view their own filed reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

-- Reviewing reports (status/dismissal) is an admin task done directly in the
-- Supabase dashboard's table editor for now — there's no in-app moderator
-- role or panel yet.

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

-- Both sides of a block can see it exists (not who-blocked-whom beyond that)
-- so each client can symmetrically hide the other's content — standard
-- mutual-invisibility block behavior.
create policy "Participants can see a block"
  on public.blocks for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

create policy "Users can block others"
  on public.blocks for insert
  with check (auth.uid() = blocker_id);

create policy "Users can unblock"
  on public.blocks for delete
  using (auth.uid() = blocker_id);

-- Enforce the block at the database level too, not just by hiding it in the
-- UI: a blocked relationship (either direction) prevents new messages.
create or replace function public.messages_block_check()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.blocks
    where (blocker_id = new.sender_id and blocked_id = new.recipient_id)
       or (blocker_id = new.recipient_id and blocked_id = new.sender_id)
  ) then
    raise exception 'Cannot message a user you have blocked or been blocked by';
  end if;
  return new;
end;
$$;

create trigger on_message_block_check
  before insert on public.messages
  for each row execute function public.messages_block_check();
