"use client";

import { useActionState, useState } from "react";

import { clearApproved, type SubmitState } from "@/app/venue/actions";
import type { House } from "@/lib/types";
import { houseName } from "@/lib/types";

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
  graded,
  grades,
  weekLabel,
}: {
  venueId: string;
  finished: number;
  /**
   * Whether every house that counts has been graded for the week this finished
   * work belongs to. Two people grade, so one signature is not a closed week —
   * resetting on the strength of the dining room alone would clear a kitchen
   * nobody had looked at.
   */
  graded: boolean;
  /** Who signed each house off, so an outstanding one can be named. */
  grades: { house: House; gradedBy: string | null; scored: boolean }[];
  weekLabel: string;
}) {
  const [state, action, pending] = useActionState(clearApproved, initial);
  const [by, setBy] = useState("");

  if (finished === 0) return null;

  // Waiting on the grade. Leaders were told reset comes "once graded", and a
  // board cleared before the week has been judged as a whole is the thing that
  // promise was made against.
  // Named, not just counted. "Waiting on the grade" with two graders left a
  // leader with nobody to chase; the house that has not been signed off is the
  // one fact that makes the wait actionable.
  const outstanding = grades
    .filter((grade) => grade.scored && !grade.gradedBy)
    .map((grade) => houseName(grade.house).toLowerCase());

  if (!graded) {
    return (
      <section className="panel mb-5">
        <p className="card-title">Reset board · waiting on the grade</p>
        <p className="note text-muted mt-1 leading-relaxed">
          {finished === 1
            ? "One task is signed off."
            : `${finished} tasks are signed off.`}{" "}
          You can clear them and take new jobs once the week of {weekLabel} has
          been graded
          {outstanding.length > 0
            ? ` — still waiting on ${outstanding.join(" and ")}`
            : ""}
          . Everything else works as normal in the meantime — file photos, redo
          anything sent back.
        </p>
      </section>
    );
  }

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
      <p className="label mt-2">
        Week of {weekLabel} graded
        {grades
          .filter((grade) => grade.scored && grade.gradedBy)
          .map(
            (grade) =>
              ` · ${houseName(grade.house).toLowerCase()} by ${grade.gradedBy}`,
          )
          .join("")}
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
