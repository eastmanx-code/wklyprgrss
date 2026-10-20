-- Self-serve manager signup.
--
-- Until now a manager's code was minted by an admin on /admin/codes, one row
-- at a time. Onboarding a venue meant collecting every manager's name and
-- typing a six-digit code for each. This lets a venue enrol its own managers
-- from a single link the GM hands out: the person names themselves, chooses
-- their own code, and confirms with the venue PIN the crew already has.
--
-- Two columns on venues and a small attempts log. The log exists because this
-- is the first door a signed-out stranger can push on, and the rest of the app
-- throttles nothing.

alter table venues
  add column signup_token uuid not null default gen_random_uuid(),
  add column signup_open boolean not null default false;

-- The link carries the token, not the venue id, so it cannot be guessed from a
-- venue and can be rotated if it ever leaks. gen_random_uuid() is volatile, so
-- each existing row is filled with its own distinct value by the add above.
create unique index venues_signup_token_key on venues (signup_token);

-- One row per signup attempt against a venue, success or failure. Read only to
-- throttle: too many failed venue-PIN tries in a short window and the venue's
-- link goes quiet for a few minutes. Not a record kept for its own sake.
create table signup_attempts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  ok boolean not null,
  created_at timestamptz not null default now()
);

create index signup_attempts_venue_recent
  on signup_attempts (venue_id, created_at desc);
