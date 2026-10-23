-- Day-of-week scheduling, one rung up from the deep clean rota.
--
-- The rota already lets an item belong to a single night: a heading that
-- names a weekday means that item is owed that day and greyed the rest, which
-- is how a deep clean asks for one of its seven jobs a night. That was always
-- one day per item and the heading did double duty as the schedule and as the
-- label on the wall.
--
-- Two real asks do not fit that. J&Tony's runs a SERVER list only on Friday
-- and Saturday, and the four bar-close jobs it takes over stay on bar close
-- the other five nights. Neither is one day, and neither wants a heading over
-- it. So the schedule gets its own column: the set of weekdays an item is
-- owed, named the same forgiving way a heading is read (MONDAY … SUNDAY, case
-- and punctuation ignored).
--
--   days = '{}'                              owed every night (the default,
--                                            which is almost every item)
--   days = '{FRIDAY,SATURDAY}'               owed Fri and Sat only
--   days = '{SUNDAY,MONDAY,TUESDAY,WEDNESDAY,THURSDAY}'   owed the other five
--
-- An empty set is "every night", so every row already in the table keeps
-- behaving exactly as it did. A day set takes precedence over a weekday
-- heading; see dueOnNight in src/lib/due.ts, which both the screen and the
-- scoring read from, so a night signed against a day-scoped list freezes what
-- was actually owed.

alter table close_items
  add column if not exists days text[] not null default '{}';

comment on column close_items.days is
  'Weekdays this item is owed (MONDAY…SUNDAY), empty for every night. '
  'Precedes a weekday heading. Read by dueOnNight.';

-- A venue's own word for a list, shown to the crew in place of the phase.
--
-- The phase stays open/mid/close — the night roll, the attestation wording and
-- the scoring all hang off it and none of that changes. This is only the label
-- on the clipboard: J&Tony's runs its cafe mid list as "PRE CLOSE" and that is
-- what the crew should read when they pick it and when they open it. Null
-- means show the phase name, which is every list that has not asked for its
-- own word. Shown verbatim in both languages, the same as a room.

alter table close_checklists
  add column if not exists phase_label text;

comment on column close_checklists.phase_label is
  'A venue''s own label for this list in place of the phase name, e.g. '
  '"PRE CLOSE". Null shows the phase. Display only; phase is unchanged.';
