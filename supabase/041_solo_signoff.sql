-- Whether a list asks for a second signature, or is signed off alone.
--
-- Every close list takes two signatures: the person who did the work signs,
-- and then someone else on the crew checks it and signs too. It is a witness,
-- not a permission, and it is the thing that stops one phone recording one
-- person as having closed a whole bar by themselves.
--
-- Some lists are genuinely worked alone. A retail opener sets up the shop with
-- nobody else on the clock; a closing lead on a quiet night is the last one
-- out. There is no second person to check the work, so the second-signature
-- prompt sits there forever and a finished list reads as unfinished. The crew
-- on the floor asked for a way to turn it off on those lists.
--
-- Now there is. False keeps the second signature, which is every existing list
-- and the right default. True turns it off for a list, so it is complete on the
-- one signature and the second-signature ask is not shown. The list was always
-- complete on the first signature; this only hides the prompt that followed.
-- Not-null with a false default, so applying it ahead of the code changes
-- nothing until a list is turned on by hand.

alter table close_checklists
  add column if not exists solo_signoff boolean not null default false;

comment on column close_checklists.solo_signoff is
  'True: a list worked alone, signed off by the one person who did it, with no second-signature prompt. False: the list asks for a second signature after the first, which is every other list.';
