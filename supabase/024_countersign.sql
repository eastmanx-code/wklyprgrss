-- A second signature, from somebody who did not do the work.
--
-- The first night showed what the single signature actually records. Seven of
-- the eight signed lists were signed by the same person whose initials are on
-- every tick. One list, the mid, was signed by somebody else. At close, nobody
-- signed anyone else's work, and one person wrote "no MOD ON DUTY" in the name
-- box, which is not a joke: it is somebody reporting the truth in the only
-- field they had.
--
-- So the sentence people were signing was wrong for what they were doing. "I
-- hold myself accountable for this team's work tonight" is a manager's oath,
-- and it was being used as a timecard. Two signatures separates the two
-- claims: I did this work, and I checked it.
--
-- A list is not finished until both are on it. That is deliberate and it will
-- make Hood look worse on paper before it looks better, because a missing
-- countersign is the honest answer to a question nobody could answer from the
-- old record: is there a manager here at close.
--
-- verified_device exists because the countersign is typed, not proven. Anybody
-- can put a manager's name in the box, and somebody alone at three in the
-- morning with a list that will not complete has every reason to. This does
-- not stop them. It records whether the two signatures came off the same phone
-- and how far apart, so a countersign that was really the same person is
-- visible as one in the report rather than hidden. Same principle as the pace
-- reading: record it, show it, let a human decide.

alter table close_nights
  add column if not exists certified_device text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by text,
  add column if not exists verified_signature text,
  add column if not exists verified_device text;

comment on column close_nights.verified_by is
  'The manager who checked the work. Typed, not proven, so treat it as a claim rather than an identity.';
comment on column close_nights.certified_device is
  'Opaque id of the phone that signed the work. Kept only to compare with the one that countersigned.';
comment on column close_nights.verified_device is
  'Opaque id of the phone that countersigned. Compared with the one that signed, to show when both signatures came from the same device.';
