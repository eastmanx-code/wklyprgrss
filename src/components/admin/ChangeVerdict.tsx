"use client";

import { useState } from "react";

import { reviewSubmission } from "@/app/admin/actions";
import { SendBack } from "./SendBack";
import { SubmitButton } from "./SubmitButton";

/**
 * A decision already made, and the way to change it.
 *
 * Every card used to carry a review button whatever its state, so a screen
 * reading "0 awaiting review" still offered ten of them — and the button on a
 * rejected task was Approve, one tap from signing off work that had been sent
 * back and never redone.
 *
 * Hiding them outright went too far the other way: correcting a verdict is a
 * real thing an admin does, not a misclick to be designed out. So the card
 * states its position, and the change is one deliberate tap behind it. What is
 * gone is only the possibility of doing it by accident.
 */
export function ChangeVerdict({
  submissionId,
  venueId,
  review,
}: {
  submissionId: string;
  venueId: string;
  review: "approved" | "sent_back";
}) {
  const [open, setOpen] = useState(false);
  const approved = review === "approved";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="label">
          {approved ? "Signed off" : "Waiting on a new photo"}
        </p>
        <button
          type="button"
          className="label hover:text-ink underline underline-offset-2"
          onClick={() => setOpen((was) => !was)}
        >
          {open ? "Keep it" : "Change"}
        </button>
      </div>

      {open ? (
        approved ? (
          <div className="flex flex-col gap-2">
            {/* An approval given by mistake is not a rejection.

                Send back was the only way out of one, and it says something
                false: it tells the leader their work was wrong and makes them
                redo it. A MOD hit approve-all on the wrong house and had to
                choose between leaving ten items signed off that nobody had
                looked at, or failing ten pieces of work that were fine. He
                had to ask for the database to be edited instead.

                This puts it back where it was — undecided, in the queue, with
                nothing said to the crew about it. */}
            <form action={reviewSubmission}>
              <input type="hidden" name="submissionId" value={submissionId} />
              <input type="hidden" name="venueId" value={venueId} />
              <input type="hidden" name="review" value="pending" />
              <SubmitButton pendingLabel="Undoing…">
                Undo, back to review
              </SubmitButton>
            </form>
            <p className="label">
              Undecided again. The crew is told nothing and keeps the work.
            </p>

            {/* Turning an approval into a rejection is the case that most wants
                a reason: the leader has already been told this was fine. */}
            <SendBack
              submissionId={submissionId}
              venueId={venueId}
              label="Send back instead"
            />
          </div>
        ) : (
          <form action={reviewSubmission}>
            <input type="hidden" name="submissionId" value={submissionId} />
            <input type="hidden" name="venueId" value={venueId} />
            <input type="hidden" name="review" value="approved" />
            <SubmitButton pendingLabel="Approving…">
              Approve instead
            </SubmitButton>
          </form>
        )
      ) : null}
    </div>
  );
}
