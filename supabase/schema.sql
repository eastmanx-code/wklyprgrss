-- Weekly Walkthrough — run this in the Supabase SQL editor.

create table venues (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  pin text not null
);

create table items (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) not null,
  title text not null,
  position int not null,
  active boolean default true
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) not null,
  week_start date not null,
  photo_url text not null,
  comment text not null,
  -- Who wrote this update, and who helped with the work.
  author text not null,
  assisted_by text,
  -- Admin review. 'sent_back' stops it counting towards the week.
  review text not null default 'pending'
    check (review in ('pending', 'approved', 'sent_back')),
  reviewed_at timestamptz,
  -- What the leader says: finished, or needs another cycle. Only 'done' work
  -- can be approved.
  progress text not null default 'done'
    check (progress in ('done', 'another_cycle')),
  created_at timestamptz default now()
);

-- RLS on with no policies at all: anon and authenticated clients can read
-- nothing and write nothing. Every query in the app goes through a Next.js
-- server action holding the service role key, which bypasses RLS by design.
alter table venues enable row level security;
alter table items enable row level security;
alter table submissions enable row level security;

-- Read paths: items by venue, submissions by item and week.
create index items_venue_id_position_idx on items (venue_id, position);
create index submissions_item_id_idx on submissions (item_id);
create index submissions_week_start_idx on submissions (week_start);
