-- Why it was sent back.
--
-- A rejection recorded nothing but the verdict and a timestamp. The leader got
-- a Redo flag and had to guess what was wrong, so they redid what they thought
-- was meant, and could be rejected twice over the same misunderstanding. It is
-- the same fault as a button that greys out without saying why, except there
-- is a person on the other end being told to do work again.
--
-- Optional on purpose. A rejection with nothing to add should still be one tap;
-- the point is that saying something stops being impossible.

alter table submissions
  add column if not exists review_note text;

comment on column submissions.review_note is
  'What the reviewer wants doing differently. Set when sending back, cleared on approval — a note about a rejection has no meaning once the work is signed off.';
