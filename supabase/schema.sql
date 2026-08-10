-- Accounts, roles and suggestions.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Every rule that matters is enforced here rather than in the browser: the app
-- ships as static JavaScript, so anything it checks client-side can be edited
-- away by whoever is looking at it. These policies are what actually stop a
-- signed-in user from approving their own suggestion.

-- ---------------------------------------------------------------- roles

create type public.user_role as enum ('user', 'admin');

create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  role       public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

-- Everyone who signs up gets a profile, always as 'user'. Promotion to admin is
-- a deliberate act (see the bottom of this file) — it is never self-served.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Reads the caller's role without tripping profiles' own row-level security,
-- which would otherwise recurse when a profiles policy asks "is this an admin?".
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------- suggestions

create table public.suggestions (
  id             bigint generated always as identity primary key,
  masjid_id      text not null,
  slot           text not null
                 check (slot in ('fajr','dhuhr','asr','maghrib','isha','jumuah')),
  -- 24-hour HH:mm, enforced at the column so a malformed time cannot be stored
  -- even if a client skips validation.
  suggested_time text not null
                 check (suggested_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  note           text,
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected')),
  created_by     uuid not null references auth.users on delete cascade,
  created_at     timestamptz not null default now(),
  reviewed_by    uuid references auth.users,
  reviewed_at    timestamptz,
  review_note    text
);

create index suggestions_status_idx on public.suggestions (status, created_at desc);

alter table public.profiles    enable row level security;
alter table public.suggestions enable row level security;

-- profiles -------------------------------------------------------------

create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "admins read every profile"
  on public.profiles for select
  using (public.is_admin());

-- Only an admin can change a role, so nobody can promote themselves.
create policy "admins change roles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- suggestions ----------------------------------------------------------

-- Signed in is the bar for suggesting. The row must be theirs, and for a normal
-- user it must start pending — they cannot insert something already approved.
-- An admin may publish directly, since making them approve their own submission
-- adds a round trip without adding a second pair of eyes; the row still records
-- who published it.
create policy "signed-in users may suggest"
  on public.suggestions for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and (
      status = 'pending'
      or (
        public.is_admin()
        and status = 'approved'
        and reviewed_by = auth.uid()
      )
    )
  );

create policy "users read their own suggestions"
  on public.suggestions for select
  to authenticated
  using (auth.uid() = created_by);

create policy "admins read every suggestion"
  on public.suggestions for select
  using (public.is_admin());

-- Reviewing is admin-only. This is the policy that makes the admin page real
-- rather than cosmetic.
create policy "admins review suggestions"
  on public.suggestions for update
  using (public.is_admin())
  with check (public.is_admin());

-- --------------------------------------------------- public read model

-- The app needs approved corrections for every visitor, including guests, but
-- must not leak who submitted what. This view exposes only the times. It runs
-- with the owner's rights, so it reads past the table's policies deliberately —
-- which is why it selects no author columns.
create view public.approved_times as
  select distinct on (masjid_id, slot)
    masjid_id,
    slot,
    suggested_time,
    reviewed_at
  from public.suggestions
  where status = 'approved'
  order by masjid_id, slot, reviewed_at desc;

grant select on public.approved_times to anon, authenticated;

-- ------------------------------------------------------- make yourself admin

-- Sign up through the app first, then run this once with your own address:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
