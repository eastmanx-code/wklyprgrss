-- Optional same-week "before" photo.
--
-- When a task is executed inside the week, the team shoots a before and an
-- after. When the item is ongoing, there is only one photo and the previous
-- week's shot serves as the before. So this is nullable, never required.

alter table submissions
  add column if not exists before_photo_url text;
