-- A position can run one list per room, not only one per phase.
--
-- The shape the app had was house, then position, then open, mid or close.
-- That fits a bartender. It does not fit a deep clean, which is one job a
-- night in three different rooms, and Hood ran it as three separate positions
-- sitting in the middle of the list of jobs people actually hold: "Bar deep
-- clean", "Noble bar deep clean", "YB Weekly sidework", none of which is
-- anybody's shift.
--
-- The ask from the floor was to tap Deep Clean and get the rooms where the
-- phases usually are. So a list can now name a room, and a position whose
-- lists carry rooms lists rooms instead of phases.
--
-- The unique key has to grow with it. Three deep cleans are all mid, so
-- (venue, house, role, phase) makes two of them impossible. Rooms are folded
-- to the empty string rather than left null so that two roomless lists still
-- collide the way they always did — in Postgres a null never equals a null,
-- which would have quietly turned the old rule off.

alter table close_checklists
  add column if not exists room text;

comment on column close_checklists.room is
  'The room this list covers, where a position runs one list per room rather than one per phase. Null for an ordinary position. Sits between the role and the phase in the list address.';

alter table close_checklists
  drop constraint if exists close_checklists_venue_id_house_role_phase_key;

create unique index if not exists close_checklists_slot_key
  on close_checklists (venue_id, house, role, phase, coalesce(room, ''));
