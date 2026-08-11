"use client";

import { useActionState, useState } from "react";

import { deleteSubmission, type SubmitState } from "@/app/venue/actions";

const initial: SubmitState = { error: null };

/**
 * Taking an entry off the board.
 *
 * Two taps, and nothing is destroyed. The row is stamped rather than deleted:
 * it leaves the board, the history and every score, and an admin can still
 * find it. This started life as a real delete, which bought a tidy board at
 * the price of the one guarantee the record has to make.
 *
 * Approved entries never show this. Once an admin has signed off on a week,
 * that entry is the record of it.
 */
export function DeleteEntry({ submissionId }: { submissionId: string }) {
  const [state, action, pending] = useActionState(deleteSubmission, initial);
  const [confirming, setConfirming] = useState(false);

  if (state.ok) return null;

  return (
    <div className="mt-3">
      {state.error ? (
        <p role="alert" className="text-body text-warn mb-2">
          {state.error}
        </p>
      ) : null}

      {confirming ? (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="submissionId" value={submissionId} />
          <button type="submit" className="btn btn-sm" disabled={pending}>
            {pending ? "Clearing…" : "Yes, clear it"}
          </button>
          <button
            type="button"
            className="btn-ghost min-h-11"
            onClick={() => setConfirming(false)}
          >
            Keep it
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="btn-ghost min-h-11"
          onClick={() => setConfirming(true)}
        >
          Clear this entry
        </button>
      )}
    </div>
  );
}
