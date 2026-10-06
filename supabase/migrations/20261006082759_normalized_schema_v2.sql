-- Handle Hub normalized schema v2 (applied to project bvynhmxyvqkitwyndlyt via Supabase apply_migration).
-- usernames ─< checks >─ platforms ; usernames ─< profiles >─ platforms ; searches ; selftest_runs
-- Views: latest_checks, platform_health (security_invoker). RLS: public read, writes via service role.

create extension if not exists citext with schema extensions;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

create table public.platforms (
  id text primary key,
  name text not null,
  category text not null default 'other'
    check (category in ('social','gaming','dev','creative','business','community','other')),
  source text not null check (source in ('adapter','wmn','sherlock','maigret')),
  definition_id text,
  enabled boolean not null default false,
  nsfw boolean not null default false,
  url_template text,
  url_main text,
  signup_url text,
  last_selftest_at timestamptz,
  selftest_passed boolean,
  health_score numeric(4,3) check (health_score is null or (health_score >= 0 and health_score <= 1)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger platforms_set_updated_at before update on public.platforms
  for each row execute function public.set_updated_at();
create index platforms_enabled_category_idx on public.platforms (category) where enabled and not nsfw;

insert into public.platforms (id, name, category, source, enabled, url_template, url_main, signup_url, notes) values
 ('steam','Steam','gaming','adapter',true,'https://steamcommunity.com/id/{u}','https://steamcommunity.com','https://store.steampowered.com/join','Vanity URL namespace'),
 ('xbox','Xbox','gaming','adapter',true,'https://www.xbox.com/play/user/{u}','https://www.xbox.com','https://signup.live.com/',null),
 ('playstation','PlayStation','gaming','adapter',true,null,'https://www.playstation.com','https://www.playstation.com/playstation-network/',null),
 ('twitch','Twitch','gaming','adapter',true,'https://www.twitch.tv/{u}','https://www.twitch.tv','https://www.twitch.tv/signup',null),
 ('twitter','X (Twitter)','social','adapter',true,'https://x.com/{u}','https://x.com','https://x.com/i/flow/signup',null),
 ('instagram','Instagram','social','adapter',true,'https://www.instagram.com/{u}/','https://www.instagram.com','https://www.instagram.com/accounts/emailsignup/',null),
 ('tiktok','TikTok','social','adapter',true,'https://www.tiktok.com/@{u}','https://www.tiktok.com','https://www.tiktok.com/signup',null),
 ('discord','Discord','social','adapter',true,null,'https://discord.com','https://discord.com/register','Unique usernames have no public profile URL'),
 ('reddit','Reddit','social','adapter',true,'https://www.reddit.com/user/{u}','https://www.reddit.com','https://www.reddit.com/register/',null),
 ('youtube','YouTube','social','adapter',true,'https://www.youtube.com/@{u}','https://www.youtube.com','https://www.youtube.com/handle',null);

create table public.usernames (
  id uuid primary key default gen_random_uuid(),
  handle extensions.citext not null unique check (char_length(handle) between 1 and 64),
  first_seen timestamptz not null default now(),
  last_checked timestamptz
);
insert into public.usernames (handle, first_seen, last_checked)
  select username, min(checked_at), max(checked_at) from public.checks group by username
  on conflict (handle) do nothing;
insert into public.usernames (handle, first_seen)
  select username, min(created_at) from public.searches group by username
  on conflict (handle) do nothing;

alter table public.checks
  add column username_id uuid references public.usernames(id) on delete cascade,
  add column confidence text check (confidence in ('high','medium','low')),
  add column method text,
  add column latency_ms integer,
  add column http_status smallint;
update public.checks c set username_id = u.id from public.usernames u where u.handle = c.username;
update public.checks set confidence = meta->>'confidence' where meta->>'confidence' in ('high','medium','low');
update public.checks set method = meta->>'method' where meta ? 'method';
alter table public.checks alter column username_id set not null;
insert into public.platforms (id, name, source)
  select distinct platform_id, platform_id, 'adapter' from public.checks
  where platform_id not in (select id from public.platforms);
alter table public.checks
  add constraint checks_platform_id_fkey foreign key (platform_id) references public.platforms(id) on update cascade on delete cascade,
  add constraint checks_status_check check (status in ('available','taken','unknown','invalid'));

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  username_id uuid not null references public.usernames(id) on delete cascade,
  platform_id text not null references public.platforms(id) on update cascade on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  followers bigint,
  following bigint,
  posts bigint,
  verified boolean,
  profile_url text,
  raw jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  constraint profiles_username_platform_key unique (username_id, platform_id)
);
create index profiles_platform_id_idx on public.profiles (platform_id);
insert into public.profiles (username_id, platform_id, display_name, avatar_url, bio, followers, following, posts, verified, profile_url, raw, fetched_at)
  select distinct on (username_id, platform_id)
    username_id, platform_id,
    meta->'profile'->>'displayName', meta->'profile'->>'avatarUrl', meta->'profile'->>'bio',
    (meta->'profile'->>'followers')::bigint, (meta->'profile'->>'following')::bigint, (meta->'profile'->>'posts')::bigint,
    (meta->'profile'->>'verified')::boolean, profile_url, meta->'profile', checked_at
  from public.checks where meta ? 'profile'
  order by username_id, platform_id, checked_at desc;

drop index if exists public.checks_username_platform_checked_at_idx;
alter table public.checks drop column username;
create index checks_username_platform_checked_idx on public.checks (username_id, platform_id, checked_at desc);
create index checks_platform_checked_idx on public.checks (platform_id, checked_at desc);

alter table public.searches
  add column username_id uuid references public.usernames(id) on delete set null,
  add column platform_count integer,
  add column duration_ms integer,
  add column ip_hash text,
  add column source text not null default 'check' check (source in ('check','scan'));
update public.searches s set username_id = u.id from public.usernames u where u.handle = s.username;
create index searches_username_id_idx on public.searches (username_id);

create table public.selftest_runs (
  id bigint generated always as identity primary key,
  platform_id text not null references public.platforms(id) on update cascade on delete cascade,
  definition_id text,
  run_at timestamptz not null default now(),
  taken_ok boolean not null,
  available_ok boolean not null,
  passed boolean generated always as (taken_ok and available_ok) stored,
  details jsonb not null default '{}'::jsonb
);
create index selftest_runs_platform_run_idx on public.selftest_runs (platform_id, run_at desc);

create view public.latest_checks with (security_invoker = true) as
  select c.id, u.id as username_id, u.handle, c.platform_id, p.name as platform_name, p.category,
         c.status, c.reason, c.confidence, c.method, c.profile_url, c.estimate,
         c.latency_ms, c.http_status, c.meta, c.checked_at
  from public.usernames u
  cross join lateral (
    select distinct on (ch.platform_id) ch.*
    from public.checks ch
    where ch.username_id = u.id
    order by ch.platform_id, ch.checked_at desc
  ) c
  join public.platforms p on p.id = c.platform_id;

create view public.platform_health with (security_invoker = true) as
  select p.id, p.name, p.category, p.source, p.enabled, p.nsfw, p.url_main,
         p.selftest_passed, p.last_selftest_at, p.health_score, p.notes,
         coalesce(s.checks_24h, 0) as checks_24h,
         coalesce(s.taken_24h, 0) as taken_24h,
         coalesce(s.available_24h, 0) as available_24h,
         coalesce(s.unknown_24h, 0) as unknown_24h,
         case when s.checks_24h > 0 then round(s.unknown_24h::numeric / s.checks_24h, 3) end as unknown_rate_24h,
         s.avg_latency_ms_24h,
         s.last_checked_at
  from public.platforms p
  left join lateral (
    select count(*) as checks_24h,
           count(*) filter (where c.status = 'taken') as taken_24h,
           count(*) filter (where c.status = 'available') as available_24h,
           count(*) filter (where c.status = 'unknown') as unknown_24h,
           round(avg(c.latency_ms))::integer as avg_latency_ms_24h,
           max(c.checked_at) as last_checked_at
    from public.checks c
    where c.platform_id = p.id and c.checked_at > now() - interval '24 hours'
  ) s on true;

alter table public.platforms enable row level security;
alter table public.usernames enable row level security;
alter table public.profiles enable row level security;
alter table public.selftest_runs enable row level security;
create policy platforms_public_read on public.platforms for select to anon, authenticated using (true);
create policy usernames_public_read on public.usernames for select to anon, authenticated using (true);
create policy profiles_public_read on public.profiles for select to anon, authenticated using (true);
create policy selftest_runs_public_read on public.selftest_runs for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.platforms, public.usernames, public.profiles,
  public.selftest_runs, public.checks, public.searches from anon, authenticated;
revoke select on public.searches from anon, authenticated;
grant select (id, username, username_id, created_at, results_summary, platform_count, duration_ms, source)
  on public.searches to anon, authenticated;
grant select on public.latest_checks, public.platform_health to anon, authenticated;
