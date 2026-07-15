-- ====================================================================
-- Credora migration 005: direct messages
-- Run in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- No storage bucket needed for this one — text only.
-- ====================================================================

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint no_self_message check (sender_id <> recipient_id)
);

create index messages_participants_idx on public.messages (sender_id, recipient_id, created_at);
create index messages_recipient_unread_idx on public.messages (recipient_id, read);

alter table public.messages enable row level security;

create policy "Users can view messages they sent or received"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can send messages as themselves"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "Recipients can mark messages as read"
  on public.messages for update
  using (auth.uid() = recipient_id);

-- Required separately from RLS for postgres_changes to fire live
-- (learned this from the notifications feature — same step needed here).
alter publication supabase_realtime add table public.messages;
