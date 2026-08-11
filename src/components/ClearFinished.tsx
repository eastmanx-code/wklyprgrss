"use client";

import { useActionState } from "react";

import { clearApproved, type SubmitState } from "@/app/venue/actions";

const initial: SubmitState = { error: null };

/**
 * Monday, in one tap.
 *
 * The board is ten open jobs, not ten permanent ones. A task that has been
 * signed off is finished — it happened, it was photographed, an admin agreed —
 * and the only thing left is to take it off so the slot can hold the next job.
 *
 * This sits at the top rather than in a settings fold, because it is the first
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

  if (finished === 0) return null;

  return (
    <section className="panel border-ink/30 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="card-title">
            {finished} {finished === 1 ? "task is" : "tasks are"} signed off
          </p>
          <p className="note text-muted mt-1 leading-relaxed">
            Clear {finished === 1 ? "it" : "them"} off to free
            {finished === 1 ? " the slot" : " the slots"} for this week&apos;s
            work. Every photo and comment stays in the record.
          </p>
        </div>
        <form action={action} className="shrink-0">
          <input type="hidden" name="venueId" value={venueId} />
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Clearing…" : "Clear finished"}
          </button>
        </form>
      </div>

      {state.error ? (
        <p role="alert" className="text-body text-warn mt-3">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
