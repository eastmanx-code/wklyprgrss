-- Photo retention. Submission rows are kept forever — they are the record that
-- streaks, status and reports are computed from. Only the image files get
-- cleared once a week is old enough.

alter table submissions
  add column if not exists photo_purged_at timestamptz;

create index if not exists submissions_photo_purged_idx
  on submissions (photo_purged_at);
