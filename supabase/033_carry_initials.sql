-- Whether initials carry down a list, or every row is signed on its own.
--
-- The walk screen fills a row's initials from the row above it, so one person
-- walking a prep open at six in the morning types their two letters once
-- instead of twenty six times. It was built for the solo case and assumes a
-- list is worked top to bottom by one pair of hands.
--
-- A list split between two people live is the opposite shape. On a Friday the
-- Hood mid check is worked by two bartenders at once, grabbing whatever is free
-- — and the carry put the first one's initials down the whole list, so the
-- record could not say who actually did what. There was no way to say "this
-- list is shared, do not carry."
--
-- Now there is. True keeps the carry, which is every existing list and the
-- right default. False turns it off for a list, so each row starts blank and
-- each person puts their own initials on the work they did. Not-null with a
-- true default, so applying it ahead of the code changes nothing until a list
-- is turned off by hand.

alter table close_checklists
  add column if not exists carry_initials boolean not null default true;

comment on column close_checklists.carry_initials is
  'True: a row inherits the initials of the row above it, for a list one person walks top to bottom. False: every row is initialled on its own, for a list split between people working it at the same time.';
