-- Reopening a certified night, on a manager's PIN.
--
-- Somebody signs at 1am and then finds the back door was never checked. The
-- lock is right — a signed night is a record — but with no way past it the
-- honest options are to leave the record wrong or to phone whoever has
-- database access, and the first one is what actually happens.
--
-- So: unlock, and keep what was there. Each reopen pushes the previous
-- certification into history — who signed, when, the exact sentence, the
-- drawn signature, what was open at the time, and why it was reopened. The
-- live columns go back to null and the night is workable again.
--
-- An array rather than a single previous value, because a night can be
-- reopened twice and the second reopen must not erase the first.

alter table close_nights
  add column if not exists history jsonb not null default '[]'::jsonb;
