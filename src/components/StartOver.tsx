"use client";

import { useActionState, useState } from "react";

import { clearUnapproved, type SubmitState } from "@/app/venue/actions";

const initial: SubmitState = { error: null };

/**
 * Clearing a first week of testing.
 *
 * Everybody's first act on a new tool is to try it with whatever is in front
 * of them — a photo of the bar, a comment reading "test". Until now the only
 * way to undo that lived on an admin screen a leader cannot open, so the mess
 * stayed on their board until somebody else removed it.
 *
 * Approved entries are never touched, which is what makes this safe to hand
 * over: the worst a full week of this can cost is work nobody has looked at
 * yet.
 */
export function StartOver({
  venueId,
  pending: waiting,
}: {
  venueId: string;
  pending: number;
}) {
  const [state, action, running] = useActionState(clearUnapproved, initial);
  const [confirming, setConfirming] = useState(false);

  if (waiting === 0) return null;

  return (
    <section className="panel border-warn/30 mt-8">
      <p className="label text-warn">Start over</p>
      <p className="note text-muted mt-2 leading-relaxed">
        {waiting === 1
          ? "Deletes the one entry on this venue that nobody has approved yet, and the photograph with it."
          : `Deletes all ${waiting} entries on this venue that nobody has approved yet, and the photographs with them.`}{" "}
        Anything already approved stays. Your items and their names are not
        touched.
      </p>

      {state.ok ? (
        <p role="status" className="text-body mt-3">
          Cleared. Your board is back to empty slots.
        </p>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-body text-warn mt-3">
          {state.error}
        </p>
      ) : null}

      {confirming ? (
        <form action={action} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="venueId" value={venueId} />
          <button type="submit" className="btn btn-sm" disabled={running}>
            {running ? "Clearing…" : "Yes, clear them"}
          </button>
          <button
            type="button"
            className="btn-ghost min-h-11"
            onClick={() => setConfirming(false)}
          >
            Keep them
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="btn-ghost min-h-11 mt-3"
          onClick={() => setConfirming(true)}
        >
          Clear unapproved entries
        </button>
      )}
    </section>
  );
}
