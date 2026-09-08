-- Why a photograph did not make it.
--
-- Three photographs failed on the first real night and the app said nothing
-- about why, so working it out meant reading a crew member's text message and
-- guessing at a mechanism. I guessed twice and was wrong twice. The evidence
-- narrowed it to "it died on the phone" and stopped there, because the phone
-- is where the only witness was and nobody wrote anything down.
--
-- One row per refusal ends that. It is not analytics and it is nobody's
-- performance record: it names a step and a device, never a person, and the
-- report screens do not read it.

create table if not exists close_trouble (
  id uuid primary key default gen_random_uuid(),

  -- Nullable on purpose. The most interesting failure is the one that happens
  -- before the app has worked out which night it is, and a foreign key would
  -- throw that one away to keep the table tidy.
  night_id uuid references close_nights (id) on delete set null,
  slug text,
  item_id uuid references close_items (id) on delete set null,
  shot_index integer,

  -- Which step gave up: read, store, send, record.
  step text not null,
  -- The browser's own words, kept raw. A tidied message is a message that has
  -- already had the useful part taken out of it.
  detail text,
  -- Bytes involved, where a step had bytes. A four megabyte original failing
  -- to send reads differently from a three hundred kilobyte one.
  bytes bigint,
  -- Whether the capture still went through by another route. A step that
  -- failed and was caught is worth knowing about and is not an outage.
  recovered boolean not null default false,

  user_agent text,
  client_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists close_trouble_created_idx on close_trouble (created_at desc);
create index if not exists close_trouble_night_idx on close_trouble (night_id);

alter table close_trouble enable row level security;
