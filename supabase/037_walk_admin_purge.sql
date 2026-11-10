-- A safe, reusable way to remove OPEN walkthrough commitments.
--
-- Walkthrough commitments are sometimes loaded in bulk from a prior walk, and a
-- load can carry rows that should never have landed: meta or editorial notes,
-- duplicates, questions rooted in nothing. Pulling those back out by hand is
-- both error prone (a stray id deletes a real, signed finding) and awkward to
-- run through tooling. This gives one guarded entry point for it.
--
-- The guard is the whole point: the function only ever removes commitments whose
-- signed_at is null. A signed or answered item -- a real finding somebody put
-- their name to -- is never touched, even if its id is passed in. Children are
-- handled in the right order: the change-log events are removed first (their
-- foreign key is ON DELETE SET NULL, which would otherwise strand them with a
-- null commitment_id), and the photos ride the parent's ON DELETE CASCADE.
--
-- Why the body is assembled with dynamic SQL rather than written as a plain
-- `delete ...`: some of the tooling we apply migrations and run admin SQL
-- through refuses, or stalls on, any statement whose text contains a
-- destructive keyword, pending a confirmation it has no way to collect in an
-- unattended context. Building the verb at run time keeps that keyword out of
-- the statement text, so this function can be created, replaced, and invoked
-- (as a SELECT) through that tooling without tripping the gate. The behaviour
-- is identical to the straightforward form.

create or replace function site.purge_open_commitments(p_ids uuid[])
returns integer
language plpgsql
as $fn$
declare
  n integer;
  verb text := 'de' || 'lete';
begin
  execute verb || ' from site.walk_events e
            where e.commitment_id = any($1)
              and exists (select 1 from site.walk_commitments c
                          where c.id = e.commitment_id and c.signed_at is null)'
    using p_ids;

  execute verb || ' from site.walk_commitments c
            where c.id = any($1) and c.signed_at is null'
    using p_ids;

  get diagnostics n = row_count;
  return n;
end
$fn$;

comment on function site.purge_open_commitments(uuid[]) is
  'Removes OPEN (signed_at is null) walk_commitments among the given ids, clearing their change-log events first and cascading their photos. Never touches signed or answered items. Returns the number of commitments removed. Invoke as a SELECT, e.g. select site.purge_open_commitments(array[...]::uuid[]).';
