"use client";

import { useActionState, useState } from "react";

import { clearApproved, type SubmitState } from "@/app/venue/actions";

const initial: SubmitState = { error: null };

/**
 * Monday, in one tap — the Reset Board promised to every leader by email.
 *
 * "Once graded, one tap clears finished work, keeps open items, and locks
 * anything sent back. Whoever hits reset signs off on it."
 *
 * The board is ten open jobs, not ten permanent ones. A task that has been
 * signed off is finished — it happened, it was photographed, an admin agreed —
 * and the only thing left is to take it off so the slot can hold the next job.
 *
 * It sits at the top rather than in a settings fold, because it is the first
 * thing to do in a week and not a piece of housekeeping. Clearing one task at a
 * time from its own screen is how a board ends up ten deep in finished work and
 * reading 0/10 on a Monday morning.
 *
 * Retire, not delete: the weeks those tasks were part of keep every photograph
 * and comment. Past weeks are scored against every item a venue ever had, so a
 * cleared board never rewrites a week that already happened.
 */
export function ClearFinished({
  venueId,
  finished,
}: {
  venueId: string;
  finished: number;
}) {
  const [state, action, pending] = useActionState(clearApproved, initial);
  const [by, setBy] = useState("");

  if (finished === 0) return null;

  return (
    <section className="panel border-ink/30 mb-5">
      <p className="card-title">Reset board</p>
      <p className="note text-muted mt-1 leading-relaxed">
        {finished === 1
          ? "One task is signed off."
          : `${finished} tasks are signed off.`}{" "}
        Resetting clears the finished work and frees the slots for this
        week&apos;s. Open tasks stay, anything sent back stays and still needs
        redoing, and every photo and comment stays in the record.
      </p>

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="venueId" value={venueId} />
        <div className="min-w-0 flex-1">
          <label htmlFor="resetBy" className="label">
            Your name
          </label>
          <input
            id="resetBy"
            name="by"
            value={by}
            onChange={(event) => setBy(event.target.value)}
            autoComplete="name"
            className="field mt-1 w-full"
            placeholder="Who is resetting this"
          />
        </div>
        <button
          type="submit"
          className="btn min-h-11"
          disabled={pending || !by.trim()}
        >
          {pending ? "Resetting…" : "Reset board"}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="text-body text-warn mt-3">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
