-- Let a signed-in person delete their own account from inside the app.
--
-- Apple's App Store guideline 5.1.1(v): an app that lets people create an
-- account must also let them delete it in the app — signing out is not
-- enough. The app holds only the anon key and cannot touch auth.users, so
-- deletion is a security-definer function that can remove exactly one row:
-- the caller's own.
--
-- Their profile and their suggestions go with them (both cascade). A time
-- someone approved as an admin stays published; it just no longer names who
-- reviewed it, instead of blocking the deletion.
--
-- Run once: Dashboard → SQL Editor → New query → paste this file → Run.

alter table public.suggestions
  drop constraint if exists suggestions_reviewed_by_fkey,
  add constraint suggestions_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users on delete set null;

create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
