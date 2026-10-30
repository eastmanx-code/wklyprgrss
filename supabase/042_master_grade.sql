-- The master grade-all gate.
--
-- One tap grades every venue's finished week at once and approves everything
-- filed, stamped with one name. That is a lot of authority behind one button,
-- so it sits behind a PIN only the owner holds, kept here rather than among the
-- login PINs in admin_pins: this is not a way in, it is a key to one action.
--
-- A single row, the maintenance_lock pattern: id is a boolean pinned true, so
-- there is only ever one. pin is the code that unlocks the action; grader is
-- the name written onto every graded_weeks row it closes. Both null until the
-- owner sets them from Admin, and the action refuses to run until they are.
--
-- Service role only. RLS on with no policies, like the other owner-only tables,
-- so the anon and authenticated keys cannot read the code.

create table if not exists public.master_grade (
  id boolean primary key default true,
  pin text,
  grader text,
  updated_at timestamptz not null default now(),
  constraint master_grade_singleton check (id)
);

alter table public.master_grade enable row level security;

comment on table public.master_grade is
  'Single-row gate for the one-tap master grade-all. pin unlocks the action; grader is the name stamped on every graded_weeks row it writes. Service role only, set from Admin.';

insert into public.master_grade (id) values (true) on conflict (id) do nothing;
