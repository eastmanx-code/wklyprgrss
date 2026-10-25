-- A week is carried when it cannot be graded on time.
--
-- The grader for a house is sometimes away the week the walk lands — nobody to
-- rule on it by Thursday. Until now there was nothing that meant "held, not
-- failed": the week sat as an auto-fail for the missing grade, and when the
-- board was rebuilt for the following week its filings were orphaned on the
-- retired cards, so a board that walked and filed its ten read as a one-card
-- fail. A carry says the opposite out loud: the work happened, grading is
-- deferred, score it against the cards it was actually filed against and do not
-- fail it for the grade that could not happen yet.
--
-- Per venue and per house and per week, with a name on it, exactly like a
-- grade — the two are the same kind of act, one deferring what the other
-- records. Grading the week later supersedes the carry.

create table if not exists carried_weeks (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues (id) on delete cascade,
  week_start date not null,
  house text not null check (house in ('FOH', 'HOH')),
  carried_at timestamptz not null default now(),
  carried_by text not null,
  unique (venue_id, week_start, house)
);

create index if not exists carried_weeks_venue_week_house_idx
  on carried_weeks (venue_id, week_start, house);

alter table carried_weeks enable row level security;
