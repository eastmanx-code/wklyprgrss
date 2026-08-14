"use client";

import { useState } from "react";

import { reviewSubmission } from "@/app/admin/actions";
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
        <form action={reviewSubmission}>
          <input type="hidden" name="submissionId" value={submissionId} />
          <input type="hidden" name="venueId" value={venueId} />
          <input
            type="hidden"
            name="review"
            value={approved ? "sent_back" : "approved"}
          />
          <SubmitButton
            pendingLabel={approved ? "Sending back…" : "Approving…"}
          >
            {approved ? "Send back instead" : "Approve instead"}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
