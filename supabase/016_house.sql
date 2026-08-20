-- Front of house and heart of house, on the same board.
--
-- The walkthrough has been one list of ten per venue since it started. The
-- kitchen now gets its own ten, and the two are scored apart: a venue can keep
-- a spotless dining room and a filthy walk-in, and one number covering both
-- would let the first hide the second. That is the whole reason for splitting
-- rather than raising the target to twenty.
--
-- Every item that exists today becomes FOH. The column defaults to it, so the
-- current board, its history and its scores are untouched by this migration —
-- nothing reads `house` until the code that understands it ships.

alter table items
  add column if not exists house text not null default 'FOH'
    check (house in ('FOH', 'HOH'));

comment on column items.house is
  'Which board this item belongs to. FOH and HOH are graded separately and never summed.';

-- Read path is "this venue''s items, this house, in order".
create index if not exists items_venue_house_position_idx
  on items (venue_id, house, position);

-- A week is graded once per house, by whoever graded it.
--
-- Two people grade now — one walks the dining room, one walks the kitchen —
-- and the old unique key was (venue_id, week_start) with a single graded_by.
-- The second grader would have overwritten the first, so the record would have
-- shown one name and silently lost the other. Each house carries its own
-- signature and its own timestamp.
--
-- Existing rows are FOH by default, which is what they were.
alter table graded_weeks
  add column if not exists house text not null default 'FOH'
    check (house in ('FOH', 'HOH'));

alter table graded_weeks
  drop constraint if exists graded_weeks_venue_id_week_start_key;

alter table graded_weeks
  add constraint graded_weeks_venue_week_house_key
    unique (venue_id, week_start, house);

comment on column graded_weeks.house is
  'Which board this grade covers. FOH and HOH are graded independently, each with its own graded_by.';

drop index if exists graded_weeks_venue_week_idx;
create index if not exists graded_weeks_venue_week_house_idx
  on graded_weeks (venue_id, week_start, house);
