-- Let a suggestion say "N minutes after the adhan" instead of a clock time.
--
-- Run this in the Supabase SQL editor if you already ran schema.sql. New
-- installs get it from schema.sql, which carries the same shape.
--
-- Maghrib is called a few minutes after sunset, and sunset moves every day, so
-- a fixed clock time for it is wrong by tomorrow. An offset tracks the adhan
-- instead: "5 minutes after" stays correct all year. Every masjid differs —
-- some pray almost immediately, some wait ten minutes — so the offset is per
-- masjid and comes from whoever knows that masjid.

alter table public.suggestions
  add column if not exists offset_minutes integer;

-- A suggestion now carries one form or the other, so the clock time is optional.
alter table public.suggestions
  alter column suggested_time drop not null;

-- Exactly one of the two, never both and never neither.
alter table public.suggestions
  drop constraint if exists suggestion_has_exactly_one_form;
alter table public.suggestions
  add constraint suggestion_has_exactly_one_form
  check (
    (suggested_time is not null and offset_minutes is null)
    or (suggested_time is null and offset_minutes is not null)
  );

-- An hour and a half is already implausible for a gap between adhan and
-- iqamah; anything beyond it is a typo, not a schedule.
alter table public.suggestions
  drop constraint if exists offset_minutes_plausible;
alter table public.suggestions
  add constraint offset_minutes_plausible
  check (offset_minutes is null or (offset_minutes >= 0 and offset_minutes <= 90));

-- The public read model has to carry the offset too, or the app can't apply it.
drop view if exists public.approved_times;

create view public.approved_times as
  select distinct on (masjid_id, slot)
    masjid_id,
    slot,
    suggested_time,
    offset_minutes,
    reviewed_at
  from public.suggestions
  where status = 'approved'
  order by masjid_id, slot, reviewed_at desc;

grant select on public.approved_times to anon, authenticated;
