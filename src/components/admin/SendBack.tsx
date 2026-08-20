"use client";

import { useState } from "react";

import { reviewSubmission } from "@/app/admin/actions";
import { SubmitButton } from "./SubmitButton";

/**
 * Send it back, and say why if there is anything to say.
 *
 * A rejection used to record the verdict and nothing else. The leader got a
 * Redo flag, guessed at what was wrong, redid what they thought was meant, and
 * could be rejected a second time over the same misunderstanding. Somebody is
 * being told to do work again; they should be told what work.
 *
 * The note is optional and stays optional. A rejection with nothing to add is
 * still one extra tap, not a form to fill in — what changed is that saying
 * something stopped being impossible. Required, it would have collected
 * "redo" five hundred times and taught everyone to ignore the field.
 */
export function SendBack({
  submissionId,
  venueId,
  label = "Send back",
}: {
  submissionId: string;
  venueId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="btn-ghost text-warn min-h-11"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    );
  }

  return (
    <form action={reviewSubmission} className="flex flex-col gap-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="review" value="sent_back" />

      <label htmlFor={`note-${submissionId}`} className="label">
        What needs doing? Optional
      </label>
      <textarea
        id={`note-${submissionId}`}
        name="note"
        rows={2}
        maxLength={500}
        autoFocus
        className="field w-full"
        placeholder="e.g. photo is of the wrong shelf"
      />

      <div className="flex flex-wrap gap-2">
        <SubmitButton className="btn btn-sm" pendingLabel="Sending back…">
          {label}
        </SubmitButton>
        <button
          type="button"
          className="btn-ghost min-h-11"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
