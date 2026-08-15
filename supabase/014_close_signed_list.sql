-- The list as it stood when it was signed.
--
-- The report recomputes an old night against the list as it is *today*. That is
-- fine while nothing changes and wrong the moment anything does: rewrite a line
-- from "hood filters degreased" to "hood area tidy" and every night already
-- recorded is retroactively measured against the easier wording, silently, with
-- the numbers still moving. Retire a line that keeps coming up open and it
-- leaves the past as though the job was never owed.
--
-- An audit log would tell you afterwards that somebody changed it. This means
-- they cannot change it. A certified night stops depending on the live tables
-- and becomes a document: these were the lines, this is what was ticked, this
-- is who ticked each one, and here is the signature against that exact set.
--
-- Editing tonight's list stays completely free — a list gets scratched and
-- rewritten, that is what a list is. It just no longer reaches backwards.
--
-- Held on the night rather than in a versions table because it is written once,
-- read whole, and never queried into — the same reasoning as open_at_signing,
-- which this sits beside and supersedes for anything signed after it exists.
--
-- Null on every night signed before this migration. Those cannot be recovered,
-- which is the reason to add it before the first venue starts running nights
-- rather than after.

alter table close_nights
  add column if not exists list_at_signing jsonb;

comment on column close_nights.list_at_signing is
  'The checklist as signed: every item with its wording, its proof spec, and whether it was ticked and by whom. Written once at certification, never updated. Null for nights signed before this column existed.';
