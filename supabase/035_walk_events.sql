-- The walkthrough change log: who did what, and when.
--
-- Managers can now pull a photo off an open item and answer a question in the
-- app, on top of signing off. Those are real edits to the record, so each one
-- leaves a line here: the act, the name behind it, and the item it touched.
-- This is the accountability behind the new remove button. A photo put on the
-- wrong task and taken back off is a two line story now, not a silent change.
--
-- Read only by the service role, like the rest of the walkthrough tables, and
-- shown in the app to managers and admins alone. A leader signs the work; a
-- manager is the one who answers for it.
--
-- Append only in practice: the app never updates or deletes a row here. A
-- commitment that is later removed nulls its link rather than erasing the line,
-- so the history survives the thing it described.

create table if not exists walk_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references walk_properties (id) on delete cascade,
  -- Nulled, not deleted, if the commitment is ever removed, so the log outlives
  -- the item it recorded.
  commitment_id uuid references walk_commitments (id) on delete set null,
  -- photo_added, photo_removed, signed, question_answered, reopened. Text, not
  -- an enum, so a new kind of act does not need a migration; the app knows the
  -- set and labels the rest generically.
  kind text not null,
  -- The name put to it where the act carries one (a sign off, an answer, a photo
  -- upload), or the role that did it where it does not (a removal, a reopen).
  actor text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists walk_events_property_idx
  on walk_events (property_id, created_at desc);

-- Same lockdown as every other walkthrough table: RLS on, no policy, so nothing
-- but the server's service-role key can read or write it.
alter table walk_events enable row level security;

comment on table walk_events is
  'Append-only change log for walkthrough edits: photo added or removed, signed, answered, reopened. Shown to managers and admins.';
