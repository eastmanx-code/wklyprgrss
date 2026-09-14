-- The mega walkthroughs, and the commitments they leave behind.
--
-- A walkthrough happens at a property and produces a list of one off asks, each
-- with an owner, a due date, and a description. Today those live in an email,
-- and once the email is read nothing tracks whether any of it happened. This is
-- the third section of the app, alongside the checklists and the weekly board:
-- same shape, different thing. The checklists track what happens every night.
-- This tracks the commitments, which are dated and one off, not recurring.
--
-- A property is a building. It links to the checklist venue of the same name so
-- the venue's manager reaches their own property and nobody else's, the same
-- scoping the rest of the app already uses. Admin reaches every property.
--
-- A walkthrough is a dated set. A new one never overwrites the last: the old
-- set stays visible so a property can see what was asked before and whether it
-- has come up again.
--
-- A commitment is closed by a signature with a photo behind it. The proof is
-- the check, the same rule the close lists live by. Nothing here is scored.
-- These four tables are new and nothing live reads them, so this is safe to
-- apply ahead of the code.

create table if not exists walk_properties (
  id uuid primary key default gen_random_uuid(),
  -- The checklist venue this building is, for manager scoping. Null is allowed
  -- so a property can exist before it has a venue, but the four seeded here all
  -- have one.
  venue_id uuid references venues (id) on delete set null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists walkthroughs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references walk_properties (id) on delete cascade,
  walked_on date not null,
  walked_by text,
  created_at timestamptz not null default now()
);

create index if not exists walkthroughs_property_idx on walkthroughs (property_id);

create table if not exists walk_commitments (
  id uuid primary key default gen_random_uuid(),
  walkthrough_id uuid not null references walkthroughs (id) on delete cascade,
  -- food_safety, repair, checklist_add, checklist_rewrite, open_question,
  -- future_goal, covered. Text rather than an enum so a new category on a later
  -- walk does not need a migration; the app knows the set.
  category text not null,
  commitment text not null,
  -- 'Venue' or 'B'. The property owns the work, not a person, so a task does not
  -- die when someone is off. B owns the things the office sends a vendor for.
  owner text not null default 'Venue',
  -- Null for a future goal, which has no date and never goes overdue.
  due date,
  -- The manual repeat flag off the walk, like "3rd time raised". The app also
  -- counts repeats across a property's walkthroughs; this is the walker's note.
  repeat_note text,
  position integer not null default 0,
  -- The sign off. All null until a manager closes it with a photo.
  signed_at timestamptz,
  signed_by text,
  note text,
  -- Only admin can reopen a signed item, in case the photo did not show what
  -- was asked. Kept for the record rather than nulling the signature outright.
  reopened_at timestamptz,
  reopened_by text,
  created_at timestamptz not null default now()
);

create index if not exists walk_commitments_walkthrough_idx
  on walk_commitments (walkthrough_id);

create table if not exists walk_photos (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references walk_commitments (id) on delete cascade,
  -- A path in the same storage bucket the close photos use.
  path text not null,
  uploaded_by text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists walk_photos_commitment_idx
  on walk_photos (commitment_id);

comment on table walk_properties is
  'A building that gets mega walkthroughs. Links to its checklist venue for manager scoping.';
comment on table walkthroughs is
  'One dated walkthrough of a property. A new one never overwrites the last; the old set stays as history.';
comment on table walk_commitments is
  'One open ask from a walkthrough. Closed by a signature with a photo behind it. Never scored.';
comment on table walk_photos is
  'Proof that a commitment was done. At least one is required before it can be signed.';
