-- Why a list was signed with work not done.
--
-- The stop screen already made a person read the items they were leaving
-- before they could sign. It did not make them say why, and on the first
-- Thursday a deep clean was signed at 6:18pm with its one item untouched and
-- no word about it. The signature said "I am leaving this unfinished" and
-- the manager was left to text and ask.
--
-- So a list with items open cannot be signed without a reason, and the
-- reason lives here, next to the list of what was open. Null on every night
-- signed complete, and on every night signed before this shipped.
--
-- Nullable and unread by anything live, so it is safe to apply ahead of the
-- code — the same order as the manager codes column.

alter table close_nights
  add column if not exists open_reason text;

comment on column close_nights.open_reason is
  'Why the signer left items open. Required by the app when open_at_signing is not empty. Null when the list was signed complete.';
