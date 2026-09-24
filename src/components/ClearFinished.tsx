"use client";

import { useActionState, useState } from "react";

import { clearApproved, type SubmitState } from "@/app/venue/actions";
import type { House } from "@/lib/types";
import { houseName } from "@/lib/types";

const initial: SubmitState = { error: null };

/**
 * Monday, in one tap, for one house at a time.
 *
 * "Once graded, one tap clears finished work, keeps open items, and locks
 * anything sent back. Whoever hits reset signs off on it."
 *
 * One section per house, each gated on its own grade, because the two halves
 * are graded by two different people and a board should never wait on the one
 * that has not come in. A dining room signed off on Monday can clear itself
 * while the kitchen grade is still outstanding, rather than the whole board
 * freezing on a single missing signature with the leader no way to act.
 *
 * Retire, not delete: the weeks those tasks were part of keep every photograph
 * and comment. Past weeks are scored against every item a venue ever had, so a
 * cleared board never rewrites a week that already happened.
 */
export function ClearFinished({
  venueId,
  house,
  finished,
  /** Whether this house has been graded for the week the finished work is in. */
  graded,
  gradedBy,
  weekLabel,
}: {
  venueId: string;
  house: House;
  finished: number;
  graded: boolean;
  gradedBy: string | null;
  weekLabel: string;
}) {
  const [state, action, pending] = useActionState(clearApproved, initial);
  const [by, setBy] = useState("");

  if (finished === 0) return null;

  const label = houseName(house).toLowerCase();
  const count =
    finished === 1 ? "One task is signed off" : `${finished} tasks are signed off`;

  // Waiting on the grade. Leaders were told reset comes "once graded", and a
  // board cleared before the week has been judged is the thing that promise was
  // made against. Now it is only this house's grade that holds this house.
  if (!graded) {
    return (
      <section className="panel mb-5">
        <p className="card-title">Reset {label} · waiting on the grade</p>
        <p className="note text-muted mt-1 leading-relaxed">
          {count} in your {label}. You can clear{" "}
          {finished === 1 ? "it" : "them"} and take new jobs once the week of{" "}
          {weekLabel} has been graded in the {label}. Everything else works as
          normal in the meantime. File photos, redo anything sent back.
        </p>
      </section>
    );
  }

  return (
    <section className="panel border-ink/30 mb-5">
      <p className="card-title">Reset {label}</p>
      <p className="note text-muted mt-1 leading-relaxed">
        {count} in your {label}. Resetting clears the finished work and frees
        the slots for this week&apos;s. Open tasks stay, anything sent back stays
        and still needs redoing, and every photo and comment stays in the record.
      </p>
      <p className="label mt-2">
        Week of {weekLabel} graded{gradedBy ? ` · by ${gradedBy}` : ""}
      </p>

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="venueId" value={venueId} />
        <input type="hidden" name="house" value={house} />
        <div className="min-w-0 flex-1">
          <label htmlFor={`resetBy-${house}`} className="label">
            Your name
          </label>
          <input
            id={`resetBy-${house}`}
            name="by"
            value={by}
            onChange={(event) => setBy(event.target.value)}
            autoComplete="name"
            className="field mt-1 w-full"
            placeholder="Who is resetting this"
            required
          />
        </div>
        <button type="submit" className="btn min-h-11" disabled={pending}>
          {pending ? "Resetting…" : `Reset ${label}`}
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
