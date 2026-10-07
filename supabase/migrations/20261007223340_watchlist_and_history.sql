-- Watchlist (alert when a handle frees up) and per-user search history.

create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  handle text not null check (handle ~ '^[A-Za-z0-9._-]{1,32}$'),
  platform_id text not null,
  last_status text check (last_status in ('available', 'taken', 'unknown', 'invalid')),
  last_checked_at timestamptz,
  -- Set by the cron job when a watched handle goes from taken to available.
  freed_at timestamptz,
  -- Set once the "it's free" email has been sent (email sending not wired yet).
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, handle, platform_id)
);

create index if not exists watchlist_last_checked_idx on public.watchlist (last_checked_at nulls first);

alter table public.watchlist enable row level security;

create policy watchlist_select_own on public.watchlist
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy watchlist_delete_own on public.watchlist
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Inserts go through the server (plan slot limits); status updates come from the cron job.
revoke all on public.watchlist from anon, authenticated;
grant select, delete on public.watchlist to authenticated;

create table if not exists public.search_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  handle text not null,
  -- check | scan | bulk | variants | suggestions | domains | api
  source text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists search_history_user_created_idx on public.search_history (user_id, created_at desc);

alter table public.search_history enable row level security;

create policy search_history_select_own on public.search_history
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy search_history_delete_own on public.search_history
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.search_history from anon, authenticated;
grant select, delete on public.search_history to authenticated;
