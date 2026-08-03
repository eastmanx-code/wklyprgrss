"use client";

import { useActionState, useState } from "react";

import { deleteSubmission, type SubmitState } from "@/app/venue/actions";

const initial: SubmitState = { error: null };

/**
 * Removing an entry that should never have been filed.
 *
 * Two taps. Unlike retiring an item, this one does not keep anything — the row
 * goes and the photographs go with it, because the case it exists for is a
 * test shot of a car park, and leaving that in the record forever is the
 * problem rather than the safeguard.
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
            {pending ? "Deleting…" : "Yes, delete it"}
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
          Delete this entry
        </button>
      )}
    </div>
  );
}
