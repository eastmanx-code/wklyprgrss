-- Leaders declare whether the task is finished or needs another cycle.
-- Admin can only approve work the leader has declared done.

alter table submissions
  add column if not exists progress text not null default 'done';

alter table submissions
  drop constraint if exists submissions_progress_check;

alter table submissions
  add constraint submissions_progress_check
  check (progress in ('done', 'another_cycle'));
