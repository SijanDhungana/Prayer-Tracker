-- Let an admin publish a time directly, without a review step.
--
-- Run this in the Supabase SQL editor if you already ran schema.sql. New
-- installs get it from schema.sql, which carries the same policy.
--
-- The original policy forced every insert to 'pending', which meant an admin
-- had to approve their own submission — a round trip with no second pair of
-- eyes in it. An admin may now insert a row already marked approved, but only
-- as themselves and only with their own id recorded as the reviewer, so the
-- row still says who published it. Nothing changes for a normal user: their
-- inserts must still be 'pending'.

drop policy if exists "signed-in users may suggest" on public.suggestions;

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
