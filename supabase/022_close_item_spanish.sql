-- The same item, said again in Spanish.
--
-- Prep at Hood is worked by somebody who does not read English, and the list
-- is twenty six instructions: run the par list, place the produce order, put
-- two lime wheels and two orange half moons in the Noble caddy. Every one of
-- those is a direction, and a direction needs words. A reference photograph
-- shows what a finished caddy looks like and cannot say which bar it belongs
-- to, how many go in it, or whether you are placing it or restocking it.
--
-- A column rather than a second list, and this is the whole point of it. A
-- Spanish copy of a checklist would double every item, split the night's ticks
-- across two lists that each look half done, and leave the compliance report
-- reporting on neither. One row, one tick, one signature. The Spanish is a
-- second label on the same fact.
--
-- Not in the reports, deliberately. Those are read by two managers in English;
-- printing both languages down every verdict row would cost the report its
-- legibility to save nobody anything, since the person who needs the Spanish
-- is reading the list rather than the report.
--
-- Titles only for now. `detail` carries sub-steps and the list that needed
-- this has one of them in twenty six items, so translating it would be
-- machinery built for a case that does not exist yet.

alter table close_items
  add column if not exists title_es text;

comment on column close_items.title_es is
  'The item in Spanish, shown under the English on the list. Null where nobody has needed it. Never used in reports.';
