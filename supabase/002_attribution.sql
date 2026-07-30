-- Attribution: every submission records who wrote it, and who helped.
-- Run this in the Supabase SQL editor if you already ran schema.sql.
-- (schema.sql now includes these columns for fresh installs.)

alter table submissions
  add column if not exists author text not null default '',
  add column if not exists assisted_by text;

-- New rows must name an author; the default above exists only so the column
-- can be added to a table that already has rows.
alter table submissions alter column author drop default;
