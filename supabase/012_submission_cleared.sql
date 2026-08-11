-- Clearing an entry stops being a delete.
--
-- A venue needs to be able to take a week of testing off its board. It got
-- that, and it got it as a real delete — the row and the photograph both gone,
-- on the reasoning that a test shot of a car park should not live in the
-- record forever.
--
-- That reasoning is worth less than the guarantee it cost. Everything else in
-- this product retires rather than deletes: items, checklists, checklist
-- items, venues. Entries are now the same. Cleared means hidden from the
-- board, the history, and every score — and still there.

alter table submissions
  add column if not exists cleared_at timestamptz;

-- Every read filters on this, so it wants an index rather than a scan.
create index if not exists submissions_cleared_at_idx
  on submissions (cleared_at)
  where cleared_at is null;
