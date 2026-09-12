-- A switch that puts every open device behind a "back in a minute" screen.
--
-- A deploy restarts the server under whoever is holding a phone. Tonight it
-- caught a crew mid list: a signed Prep list went out from under them while
-- one was reopened, and the screen they were on stopped being the screen the
-- server believed in. Nothing was lost — the ticks are saved as they are made
-- — but a person standing in a walk-in cannot tell a frozen app from a broken
-- one, and a broken one is a 911 text.
--
-- So before a deploy the admin flips this on. Every open device polls it and
-- drops a full-screen hold over the list, and lifts it the moment the deploy
-- lands and the switch goes back off. The crew waits on purpose instead of
-- fighting a screen that has quietly gone stale.
--
-- One row, forced by the boolean primary key and the check: there is one site
-- and one lock. Locked defaults false, so applying this ahead of the code
-- changes nothing until somebody turns it on. The app reads it defensively and
-- treats a missing table or empty row as unlocked, the same order of caution
-- as the manager codes column and the open reason column before it.

create table if not exists maintenance_lock (
  id boolean primary key default true,
  locked boolean not null default false,
  message text,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint maintenance_lock_singleton check (id)
);

insert into maintenance_lock (id, locked)
values (true, false)
on conflict (id) do nothing;

comment on table maintenance_lock is
  'The one-row site maintenance switch. locked true drops a hold screen over every open device; the app polls it and lifts the hold when it goes false. Read as unlocked if the row is absent.';
