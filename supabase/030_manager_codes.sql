-- A code can belong to a venue, which makes it a manager's rather than an admin's.
--
-- There were two levels and no third: the venue code on the QR by the rack,
-- and the admin code that opens all twenty one venues. Everything that writes
-- a list had to sit behind the second one, because the first is handed to
-- everybody who works there.
--
-- So four bar managers were given admin codes, and each of those codes can
-- reach every venue's board, approve submissions on any of them, and add or
-- revoke admin codes. All any of them needs is to fix their own list.
--
-- Null here is what every existing code already is: an admin, unchanged. A
-- venue id makes it a manager for that venue and nothing else — their own
-- lists, their own reports, and the one power a leader does not have, which is
-- editing and reopening.
--
-- Applied before the code that reads it, which is safe only because null is
-- the old behaviour and every row is null. The pass that scopes the four Hood
-- codes runs after the code is live, which is the other way round from the
-- deep clean rename and the reason that one broke.

alter table admin_pins
  add column if not exists venue_id uuid references venues (id) on delete cascade;

comment on column admin_pins.venue_id is
  'Null for an admin code, which reaches every venue. Set for a manager code, which reaches that venue only and can edit and reopen its lists.';

create index if not exists admin_pins_venue_idx on admin_pins (venue_id);
