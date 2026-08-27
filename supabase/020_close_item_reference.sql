-- What the item should look like when it is right.
--
-- `proof` is what an item owes you at the end: photograph the back door, shot
-- of the safe count. This is the other direction — what a person looks at
-- while they are doing the job.
--
-- The paper lists already reach for it and cannot deliver. Young Blood's
-- bartender open says "Make sure your well is FULL (**REFER TO WELL PHOTO**)"
-- and there is no well photo; the fridge order is a paragraph naming six
-- fortifieds back to front; the glassware layout is two rows of prose. Every
-- one of those is a photograph pretending to be a sentence, and a new
-- bartender on their third night is being asked to hold it in their head.
--
-- Same shape as `proof`, for the same reasons: a short ordered list, read
-- whole, never queried into. A slot with a caption and no path is a
-- placeholder — the standard has been named and nobody has taken the picture
-- yet, which is a useful thing for a manager to be able to see.

alter table close_items
  add column if not exists reference jsonb not null default '[]'::jsonb;

comment on column close_items.reference is
  'What right looks like: [{"caption":"The well, stocked","path":"close/ref/..."}]. A slot with no path is a placeholder.';
