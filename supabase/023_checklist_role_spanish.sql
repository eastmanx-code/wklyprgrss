-- The position, said again in Spanish.
--
-- Item titles were translated first because that is where the instructions
-- are, and it left the last English on the crew's screen in the loudest place
-- on it: ten yellow buttons reading BAR DEEP CLEAN, BARBACK, YB WEEKLY
-- SIDEWORK. A person who reads no English got a page that said escoge tu
-- puesto and then gave him ten choices he could not tell apart.
--
-- A column rather than a guess. The obvious cheap fix is a dictionary of bar
-- words in code, and it is wrong for the same reason the roles themselves are
-- free text: a venue calls the job whatever it calls the job. Prep, Barback
-- and YB are what these people say on shift, and which of those to translate
-- and which to leave is a judgement belonging to whoever runs the building,
-- not to a lookup table.
--
-- Null means nobody has needed it, and the English is used. So this costs
-- nothing at the twenty venues that have not asked for it.

alter table close_checklists
  add column if not exists role_es text;

comment on column close_checklists.role_es is
  'The position name in Spanish, shown wherever the role is shown to somebody reading Spanish. Null where nobody has needed it, and the English is used then.';
