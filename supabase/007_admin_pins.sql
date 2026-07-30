-- Admin codes you can add and revoke from the app, instead of editing an
-- environment variable and redeploying.
--
-- ADMIN_PIN in the environment still works and is the master key — if every
-- row here were deleted you could still get in. Nothing in the UI can remove
-- it, which is what makes locking yourself out impossible.

create table if not exists admin_pins (
  id uuid primary key default gen_random_uuid(),
  pin text unique not null,
  label text not null,
  created_at timestamptz default now()
);

alter table admin_pins enable row level security;
