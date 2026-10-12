-- A document can stand in for the photo.
--
-- Some weekly items ask for a paper artifact rather than a picture: a kitchen's
-- HOH checklist, a signed sheet, a prep list. The whole app only ever took a
-- photo, so a manager with a PDF to file had nowhere to put it and ended up
-- emailing it instead. This lets a submission carry a document as its proof.
--
-- The document is an alternative, not an addition. A submission is evidenced by
-- a photo OR a document, so photo_url stops being required and a CHECK keeps at
-- least one of the two present. Everything that scores or reports a submission
-- already counts the row, not the photo, so a document-only entry stands on its
-- own with no change to the numbers.

alter table submissions
  add column if not exists doc_url text;

comment on column submissions.doc_url is
  'Storage object path of a document (PDF) filed as proof instead of a photo. Lives in the same private photos bucket. Null when the proof is a photo.';

-- photo_url was NOT NULL from the start, back when a photo was the only kind of
-- proof. A document-only submission has no photo, so the column has to allow
-- null now. The proof itself is not made optional — the CHECK below still
-- demands one of the two.
alter table submissions
  alter column photo_url drop not null;

-- One proof, of one kind or the other. A row with neither is not a submission.
alter table submissions
  drop constraint if exists submissions_has_proof_check;
alter table submissions
  add constraint submissions_has_proof_check
  check (photo_url is not null or doc_url is not null);
