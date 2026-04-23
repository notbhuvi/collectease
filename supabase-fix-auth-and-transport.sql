-- ============================================================
-- CollectEase repair migration for auth/profile + transport RLS
-- Run in Supabase SQL Editor for the deployed project
-- ============================================================

begin;

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- Ensure profiles table exists with expected columns/checks.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'accounts'
    check (role in ('admin', 'accounts', 'sales', 'transport_team', 'transporter')),
  company_name text,
  created_at timestamptz default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists role text default 'accounts',
  add column if not exists company_name text,
  add column if not exists created_at timestamptz default now();

update public.profiles
set email = coalesce(public.profiles.email, users.email)
from auth.users as users
where users.id = public.profiles.id
  and public.profiles.email is null;

-- Backfill profiles for any auth users missing one.
insert into public.profiles (id, email, full_name, role, company_name)
select
  users.id,
  users.email,
  nullif(users.raw_user_meta_data->>'full_name', ''),
  coalesce(
    nullif(users.raw_user_meta_data->>'role', ''),
    'accounts'
  ),
  nullif(users.raw_user_meta_data->>'company_name', '')
from auth.users as users
where not exists (
  select 1
  from public.profiles profiles
  where profiles.id = users.id
);

-- Keep auth -> profiles in sync for new users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, company_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'accounts'),
    nullif(new.raw_user_meta_data->>'company_name', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = coalesce(excluded.role, public.profiles.role),
    company_name = coalesce(excluded.company_name, public.profiles.company_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.transport_loads enable row level security;
alter table public.transport_bids enable row level security;
alter table public.awarded_loads enable row level security;

drop policy if exists "own_profile_select" on public.profiles;
drop policy if exists "own_profile_insert" on public.profiles;
drop policy if exists "own_profile_update" on public.profiles;

create policy "own_profile_select"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "own_profile_insert"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "own_profile_update"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "team_admin_all_loads" on public.transport_loads;
drop policy if exists "transporter_open_loads" on public.transport_loads;

create policy "team_admin_all_loads"
  on public.transport_loads
  for all
  using (
    exists (
      select 1
      from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.role in ('admin', 'transport_team')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.role in ('admin', 'transport_team')
    )
  );

create policy "transporter_open_loads"
  on public.transport_loads
  for select
  using (
    status = 'open'
    and exists (
      select 1
      from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.role = 'transporter'
    )
  );

drop policy if exists "transporter_own_bids" on public.transport_bids;
drop policy if exists "team_admin_all_bids" on public.transport_bids;

create policy "transporter_own_bids"
  on public.transport_bids
  for all
  using (auth.uid() = transporter_id)
  with check (auth.uid() = transporter_id);

create policy "team_admin_all_bids"
  on public.transport_bids
  for select
  using (
    exists (
      select 1
      from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.role in ('admin', 'transport_team')
    )
  );

drop policy if exists "team_admin_awards" on public.awarded_loads;
drop policy if exists "transporter_own_award" on public.awarded_loads;

create policy "team_admin_awards"
  on public.awarded_loads
  for all
  using (
    exists (
      select 1
      from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.role in ('admin', 'transport_team')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.role in ('admin', 'transport_team')
    )
  );

create policy "transporter_own_award"
  on public.awarded_loads
  for select
  using (auth.uid() = transporter_id);

commit;
