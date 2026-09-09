-- Deep Clean becomes one position with three rooms.
--
-- It was three positions sitting among the jobs people actually hold:
-- "Bar deep clean", "Noble bar deep clean", "YB Weekly sidework". None of
-- those is anybody's shift, and the third does not even read as the same kind
-- of thing as the other two, which is why nobody could say out loud what the
-- set was. Asked for from the floor as: tap Deep Clean, get the rooms.
--
-- So one role, one list per room, and the rooms named after the bar rather
-- than after the job:
--
--   Deep clean · Hood         was Bar deep clean
--   Deep clean · Noble        was Noble bar deep clean
--   Deep clean · Youngblood   was YB Weekly sidework
--
-- Nothing about the work changes. Every item, every day heading and every
-- night already signed stays where it is, because all of that hangs off the
-- checklist id and none of it off the name.
--
-- The Spanish moves with it. Three roles becoming one means one name, and a
-- position shows the first translation it finds, so leaving three different
-- ones would have made which name appeared depend on row order.
--
-- Bartender becomes Hood Bartender in the same pass. There is a Noble
-- Bartender and a YB Bartender, so the unqualified one was the only bar you
-- had to already know the answer to identify.
--
-- Both change the address of a list. Applied at five in the evening, with the
-- bar open list finished, mid and close not yet started, and nobody on a deep
-- clean: the narrowest window the night offers. A phone still holding an old
-- address gets a not found and has to go back to the clipboard, which is why
-- this is not a thing to run at one in the morning.

update close_checklists
set role = 'Deep clean',
    room = 'Hood',
    role_es = 'Limpieza profunda'
where role = 'Bar deep clean';

update close_checklists
set role = 'Deep clean',
    room = 'Noble',
    role_es = 'Limpieza profunda'
where role = 'Noble bar deep clean';

update close_checklists
set role = 'Deep clean',
    room = 'Youngblood',
    role_es = 'Limpieza profunda'
where role = 'YB Weekly sidework';

update close_checklists
set role = 'Hood Bartender',
    role_es = 'Bartender Hood'
where role = 'Bartender';
