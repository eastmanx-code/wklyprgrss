-- A closer saying, on the record, that nobody else was in the building.
--
-- Every list that is not a solo list asks for a second signature after the
-- first. At Stock on 11/12 the closing MOD finished after the last manager
-- left at 12:15. There was no second person, the prompt would not go away, and
-- she signed it herself under a shortened name. The morning email then read
-- "signed by Sindy Gomez and second signed by Sin, one person twice", which is
-- true and is not what happened: she was alone.
--
-- solo_signoff (041) cannot answer this. It is a property of a list that is
-- always worked alone. This is a property of one night: tonight, on a list
-- that normally has a second person, there was not one.
--
-- So the person who signed can say so. closed_alone_at is when they said it,
-- and closed_alone_device the phone they said it from, kept for the same
-- reason the signature devices are. It is a claim, not a permission: the
-- report names every list it was made on, so a GM sees a solo close as a solo
-- close and can ask about it, where before it hid inside a second signature.
--
-- Both null on every existing night, and nothing reads them until the code
-- that sets them ships, so applying this ahead of the code changes nothing.

alter table close_nights
  add column if not exists closed_alone_at timestamptz,
  add column if not exists closed_alone_device text;

comment on column close_nights.closed_alone_at is
  'When the person who signed this night said nobody else was in the building to give a second signature. Null: not said. Cleared when the night is reopened.';
comment on column close_nights.closed_alone_device is
  'The device closed_alone_at was set from.';
