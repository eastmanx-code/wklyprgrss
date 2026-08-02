-- Leaders write their own checklists, and one column to make that recoverable.
--
-- The decision: a venue owns its lists. It can invent a role, write its own
-- items, and retire them. That is faster than routing every wording change
-- through one person, and it is how the weekly items already work.
--
-- The cost is the group report. Once Night Hawk writes "stanchions polished"
-- and Ironside writes "polish stanchions", those are two rows, and "what does
-- the group keep missing" has nothing shared to count. Completion rates still
-- compare; the missed-item ranking becomes per-venue.
--
-- template_key is the way back. Nullable, never shown to a leader, and empty
-- for everything written today. If the group view later matters, the
-- equivalent rows across venues get tagged and the comparison returns without
-- a migration or a data-cleanup project. One column now against a project
-- later is a cheap option to hold.

alter table close_items
  add column if not exists template_key text;

create index if not exists close_items_template_idx
  on close_items (template_key)
  where template_key is not null;
