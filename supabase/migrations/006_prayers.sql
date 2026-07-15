-- ====================================================================
-- Credora migration 006: real prayer tracking
-- Fixes fake data, not fake content: the streak, weekly calendar, and
-- reminder times were previously hardcoded and reset on every reload.
-- Run in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- ====================================================================

create table public.prayer_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  prayer_key text not null check (prayer_key in ('morning', 'angelus', 'rosary', 'mercy', 'evening')),
  completed_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, prayer_key, completed_on)
);

create index prayer_logs_user_date_idx on public.prayer_logs (user_id, completed_on desc);

alter table public.prayer_logs enable row level security;

create policy "Users manage their own prayer logs"
  on public.prayer_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.prayer_intentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 300),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index prayer_intentions_user_idx on public.prayer_intentions (user_id, created_at desc);

alter table public.prayer_intentions enable row level security;

create policy "Users manage their own prayer intentions"
  on public.prayer_intentions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Editable reminder times, stored per-user (previously hardcoded and
-- displayed as if they were a real setting with no way to change them).
alter table public.profiles add column if not exists reminder_times jsonb not null default '{"morning":"07:00","angelus":"12:00","evening":"21:00"}';
