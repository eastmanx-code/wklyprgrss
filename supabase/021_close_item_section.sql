-- The headings the paper lists already have.
--
-- A close list is not a flat run of jobs. Noble's closing sheet splits into
-- FIRST CUTS and CLOSING SQUAD, which is two different sets of people at two
-- different times of the night; Young Blood's opens with "Mid Shift - First
-- Cut"; the prep list separates DAILY from WEEKLY. Flatten those away and the
-- list still contains every job but stops saying who does what and when, which
-- is most of what the heading was carrying.
--
-- Plain text on the item rather than a table of sections. A heading has no
-- identity of its own and nothing hangs off it: it is a word at the top of a
-- run of items, it gets renamed by whoever is editing the list, and a section
-- that has lost its last item should stop existing rather than linger as an
-- empty row. Reordering already works on `position`, and grouping by the last
-- distinct value in position order is the same thing the paper does.
--
-- Null means what it says: this item is not under a heading. A list where
-- every item is null reads exactly as it did before, which is what the lists
-- written in the app so far should keep doing.

alter table close_items
  add column if not exists section text;

comment on column close_items.section is
  'Heading this item sits under, e.g. "FIRST CUTS". Null when the list has no headings. Grouped by run in position order, never queried as its own thing.';
