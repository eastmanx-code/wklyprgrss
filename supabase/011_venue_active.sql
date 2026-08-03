-- A venue can be taken off the picker without being deleted.
--
-- ZZTEST is a real row in this table so that development exercises the same
-- code paths the twenty-six real venues use. It also sat in the login dropdown
-- in front of every leader in the company. Retiring rather than deleting keeps
-- it usable for testing and gives a way to stand a venue down later without
-- losing a year of its photographs.

alter table venues
  add column if not exists active boolean not null default true;

update venues set active = false where code = 'ZZTEST';
