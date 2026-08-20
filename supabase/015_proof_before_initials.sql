-- Let the work happen before the signature.
--
-- Initials were demanded before anything else could start: tapping an item
-- that wanted a photograph did not open the camera, it jumped the cursor into
-- an initials box. So the order of operations was sign, then do — which is
-- backwards, and is the exact habit this product exists to break. You take the
-- photo, then you put your name to it.
--
-- The invariant worth keeping is the one on close_ticks: an item marked done
-- carries the initials of whoever did it, enforced at the column. That stays
-- exactly as it was. This only relaxes the proof rows, which are evidence
-- rather than signature — a photograph is a photograph whether or not the
-- person has initialled the row yet, and the initials land the moment the item
-- is ticked, which is still the only way an item can be marked done.
--
-- Existing rows all carry initials and keep them.

alter table close_proof
  alter column initials drop not null;

comment on column close_proof.initials is
  'Who took this shot. Null while the item is still being worked — proof can be collected before the row is signed for. Filled when the item is ticked, which still requires initials.';
