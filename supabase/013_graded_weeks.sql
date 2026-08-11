-- A week is graded when the admin says it is.
--
-- Leaders were told "once graded, one tap clears finished work" — and the app
-- had nothing that meant graded, so the reset was available the moment a task
-- was approved. A venue could clear its board before the week had been looked
-- at as a whole.
--
-- Grading is per venue and per week, and it is a real act with a name on it,
-- not something inferred from whether anything happens to be pending.

create table if not exists graded_weeks (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues (id) on delete cascade,
  week_start date not null,
  graded_at timestamptz not null default now(),
  graded_by text not null,
  unique (venue_id, week_start)
);

create index if not exists graded_weeks_venue_week_idx
  on graded_weeks (venue_id, week_start);

alter table graded_weeks enable row level security;
