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
 * Only entries nobody has judged are touched, which is what makes this safe to
 * hand over: approved work is the record of a signed-off week, a rejection is
 * the instruction to do the job again, and the worst this can cost is work
 * nobody has looked at yet.
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
          ? "Takes the one entry nobody has judged yet off your board."
          : `Takes all ${waiting} entries nobody has judged yet off your board.`}{" "}
        Anything signed off stays, anything sent back stays and still needs
        redoing, and so do your items and their names.
        Nothing is destroyed — a cleared entry leaves the board and the score,
        and an admin can still put it back.
      </p>

      {state.ok ? (
        <p role="status" className="text-body mt-3">
          Cleared. Your board is back to empty slots — nothing was destroyed.
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
          Clear unjudged entries
        </button>
      )}
    </section>
  );
}
