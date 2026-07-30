-- Admin review. Every submission starts PENDING and you either approve it or
-- send it back. Run this in the Supabase SQL editor.

alter table submissions
  add column if not exists review text not null default 'pending',
  add column if not exists reviewed_at timestamptz;

alter table submissions
  drop constraint if exists submissions_review_check;

alter table submissions
  add constraint submissions_review_check
  check (review in ('pending', 'approved', 'sent_back'));

create index if not exists submissions_review_idx on submissions (review);
