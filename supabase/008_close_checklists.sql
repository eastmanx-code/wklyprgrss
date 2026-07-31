-- Nightly close checklists.
--
-- Checklists belong to a venue rather than to the group. Per-venue can express
-- "the same everywhere" by carrying the same rows; one shared definition
-- cannot express variation without a rewrite, so per-venue is the direction
-- that can't paint us into a corner. A template layer, if it turns out every
-- venue really does run identical lists, is additive on top of this.

create table close_checklists (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) not null,
  house text not null check (house in ('FOH', 'HOH')),
  -- Free text, not an enum. The role list is the part of this taxonomy most
  -- likely to be wrong, and a check constraint would turn "we call that a
  -- barback, not a bar porter" into a migration.
  role text not null,
  phase text not null check (phase in ('open', 'mid', 'close')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (venue_id, house, role, phase)
);

create table close_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid references close_checklists(id) on delete cascade not null,
  position int not null,
  title text not null,
  -- The standard for what done means. Displayed, never separately ticked.
  detail text[] not null default '{}',
  -- The captures this item owes: [{"kind":"photo","prompt":"the back door…"}].
  -- jsonb because it is a short ordered list read whole and never queried
  -- into, and because a shot is two fields that only ever travel together.
  proof jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  unique (checklist_id, position)
);

-- One row per checklist per night. Created the moment anyone touches the list,
-- which is what lets a second person pick it up mid-shift.
create table close_nights (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid references close_checklists(id) not null,
  -- The night the shift began, not the calendar day the clock rolled over to.
  -- Resolved at 4am Pacific — see src/lib/night.ts.
  night date not null,
  certified_at timestamptz,
  certified_by text,
  -- The exact sentence that was signed, verbatim. If the wording ever
  -- changes, the record still shows what this person put their name to.
  attestation text,
  -- The drawn signature, as an image data URL.
  signature text,
  -- Which items were still open at signature, frozen at that moment.
  open_at_signing jsonb,
  created_at timestamptz not null default now(),
  unique (checklist_id, night)
);

-- An item is done. Initials are required at the column level because a tick
-- nobody signed for is the thing this whole design exists to prevent.
create table close_ticks (
  id uuid primary key default gen_random_uuid(),
  night_id uuid references close_nights(id) on delete cascade not null,
  item_id uuid references close_items(id) not null,
  initials text not null,
  created_at timestamptz not null default now(),
  unique (night_id, item_id)
);

-- The evidence, one row per shot.
--
-- Hangs off the night rather than off the tick: an item owing three
-- photographs collects them one at a time, and the tick only exists once the
-- last one lands. Attaching proof to the tick would mean nowhere to put the
-- first two.
create table close_proof (
  id uuid primary key default gen_random_uuid(),
  night_id uuid references close_nights(id) on delete cascade not null,
  item_id uuid references close_items(id) not null,
  shot_index int not null,
  kind text not null check (kind in ('photo', 'video', 'note')),
  -- Storage path for a photo or video — never a URL. Signed per request, the
  -- same as the weekly photos.
  storage_path text,
  -- The words, for a note.
  body text,
  initials text not null,
  created_at timestamptz not null default now(),
  unique (night_id, item_id, shot_index),
  -- A capture points at a file; a note carries its text. Neither is both.
  check (
    (kind = 'note' and body is not null and storage_path is null) or
    (kind <> 'note' and storage_path is not null)
  )
);

-- Same posture as the rest of the schema: RLS on, no policies at all. Every
-- query goes through a server action holding the service role key.
alter table close_checklists enable row level security;
alter table close_items enable row level security;
alter table close_nights enable row level security;
alter table close_ticks enable row level security;
alter table close_proof enable row level security;

-- Read paths: a venue's clipboard, a checklist's items, a night's work, and
-- the rollup scanning nights across a window.
create index close_checklists_venue_idx on close_checklists (venue_id, house, role);
create index close_items_checklist_idx on close_items (checklist_id, position);
create index close_nights_checklist_night_idx on close_nights (checklist_id, night desc);
create index close_nights_night_idx on close_nights (night desc);
create index close_ticks_night_idx on close_ticks (night_id);
create index close_proof_night_idx on close_proof (night_id, item_id);

-- Night Hawk's MOD close, Edition 1 — the one list that exists today. Seeded
-- here rather than left in code so the app reads every checklist the same way,
-- from the table, with nothing special-cased.
--
-- The other twenty-six slots on the clipboard stay empty until someone writes
-- them. That is deliberate: a list nobody has written is a gap worth seeing,
-- not a row worth inventing.
