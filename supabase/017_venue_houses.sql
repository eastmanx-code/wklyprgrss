-- Which halves a venue actually has.
--
-- Splitting the board assumed every venue owed both lists. Five do not: Raised
-- by Wolves, False Idol, Polite Provisions, Part Time Lover and the Lafayette
-- have no kitchen. Left alone, the rule that an unbuilt board scores nought rather than
-- being exempt — which is right, and deliberate — would have failed those four
-- on a heart of house they can never fill, every week, forever. And because a
-- venue only wins a week by winning every half it is scored on, they could
-- never have won another one.
--
-- So the exemption is not "this board is empty", which is a venue that has not
-- done the work. It is "this venue does not have this half", which is a fact
-- about the building. Those are different things and only the second is an
-- excuse.
--
-- An array rather than a boolean because the question is which halves a venue
-- runs, not whether it happens to have a kitchen, and because the list is
-- expected to change as venues open, close and rebuild.

alter table venues
  add column if not exists houses text[] not null default '{FOH,HOH}';

comment on column venues.houses is
  'The halves this venue runs. A venue is only ever scored, graded or drawn on the houses named here.';

-- No empty sets and nothing outside the two houses. A venue with no houses
-- would vanish from the scoring entirely, which is the failure this column
-- exists to make impossible to reach by accident.
alter table venues
  drop constraint if exists venues_houses_valid;
alter table venues
  add constraint venues_houses_valid check (
    array_length(houses, 1) >= 1
    and houses <@ array['FOH', 'HOH']::text[]
  );

-- As at 2026-08-20. Front of house only. Expect this list to move as venues
-- open, close and rebuild, which is why it is a column and not a constant.
update venues set houses = '{FOH}'
 where code in ('WLVS', 'FLSE', 'POLT', 'PTLV', 'LAFA');
