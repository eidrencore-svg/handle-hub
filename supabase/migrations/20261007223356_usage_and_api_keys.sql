-- Daily usage counters (anonymous IP hashes and signed-in users) + API keys.

create table if not exists public.usage_counters (
  -- 'u:<user uuid>' for accounts, 'ip:<salted daily hash>' for anonymous visitors
  subject text not null,
  -- core_check | full_scan | api | tool_run | domain_check | ...
  metric text not null,
  day date not null default ((now() at time zone 'utc')::date),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject, metric, day)
);

alter table public.usage_counters enable row level security;
-- Service role only: no policies, no grants for client roles.
revoke all on public.usage_counters from anon, authenticated;

-- Atomically add p_amount to today's counter if it stays within p_limit
-- (null limit = unlimited). Returns whether it was allowed and the new count.
create or replace function public.consume_usage(
  p_subject text,
  p_metric text,
  p_limit integer,
  p_amount integer default 1
)
returns table (allowed boolean, used integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_count integer;
begin
  if p_amount < 0 then
    raise exception 'p_amount must be >= 0';
  end if;

  insert into public.usage_counters (subject, metric, day, count)
  values (p_subject, p_metric, v_day, 0)
  on conflict (subject, metric, day) do nothing;

  update public.usage_counters as u
     set count = u.count + p_amount,
         updated_at = now()
   where u.subject = p_subject
     and u.metric = p_metric
     and u.day = v_day
     and (p_limit is null or u.count + p_amount <= p_limit)
  returning u.count into v_count;

  if found then
    return query select true, v_count;
  else
    select u.count into v_count
      from public.usage_counters as u
     where u.subject = p_subject and u.metric = p_metric and u.day = v_day;
    return query select false, coalesce(v_count, 0);
  end if;
end;
$$;

revoke execute on function public.consume_usage(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_usage(text, text, integer, integer) to service_role;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Default' check (char_length(name) between 1 and 60),
  -- First characters of the key (e.g. 'hh_AbCd1234') so users can tell keys apart.
  prefix text not null,
  -- SHA-256 (hex) of the full key. The key itself is never stored.
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_keys_user_id_idx on public.api_keys (user_id);

alter table public.api_keys enable row level security;

create policy api_keys_select_own on public.api_keys
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Clients may read their own keys' metadata (never the hash); writes go
-- through the server with the service role.
revoke all on public.api_keys from anon, authenticated;
grant select (id, user_id, name, prefix, created_at, last_used_at, revoked_at) on public.api_keys to authenticated;
