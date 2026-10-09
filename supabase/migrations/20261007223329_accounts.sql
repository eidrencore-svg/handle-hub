-- Accounts: one row per auth user with their plan. Named `accounts` because
-- `public.profiles` already holds scraped social-profile data.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'team')),
  -- Billing (filled by the Stripe webhook later; null until then)
  stripe_customer_id text unique,
  stripe_subscription_id text,
  plan_renews_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

-- Users can read their own row. No insert/update/delete policies: the plan is
-- only ever changed server-side (service role / billing webhook).
create policy accounts_select_own on public.accounts
  for select to authenticated
  using ((select auth.uid()) = id);

revoke insert, update, delete on public.accounts from anon, authenticated;

-- Create the account row on sign-up, keep email in sync.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.accounts set email = new.email, updated_at = now() where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Backfill any users created before this migration.
insert into public.accounts (id, email)
select id, email from auth.users
on conflict (id) do nothing;
