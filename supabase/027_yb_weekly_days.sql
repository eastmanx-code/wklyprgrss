-- A day on each of the YB weekly jobs, so the list can be finished.
--
-- The two deep clean lists file their seven items under MONDAY through SUNDAY,
-- one a night, and the app now asks for the one that belongs to tonight. YB
-- Weekly sidework is the same shape and never got the headings, so it kept
-- asking for all seven every night: a person who did the job in front of them
-- still saw a list that could not be finished, which is exactly the reason
-- nobody has touched the other two since launch.
--
-- Each of these is a small checklist rather than a single task. "Detail back
-- bar:" carries three steps and a photograph; "Clean McIntosh area:" carries
-- two. That is a night's work each, not a week's, and it is why seven of them
-- on one night was never the intent.
--
-- Days assigned in the order the list is already written, which is how the
-- other two are laid out and the only ordering anybody has stated. If the bar
-- would rather have the back bar on a quiet night, that is one edit per item
-- on the list screen and nothing here needs changing.

update close_items i
set section = d.day
from (values
  (1, 'MONDAY'),
  (2, 'TUESDAY'),
  (3, 'WEDNESDAY'),
  (4, 'THURSDAY'),
  (5, 'FRIDAY'),
  (6, 'SATURDAY'),
  (7, 'SUNDAY')
) as d(position, day)
where i.checklist_id = '2d53150d-dc0a-4995-ae79-5b213208426d'
  and i.position = d.position
  and i.section is null;
