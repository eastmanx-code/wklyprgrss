"use client";

import { useState } from "react";

import { gradeAllVenues } from "@/app/admin/actions";

/**
 * Closing the week for everyone, in one move.
 *
 * Grading venue by venue is twenty-one taps of bookkeeping on top of the review
 * that already happened — and the first week it existed it was missed
 * altogether, so every board in the company read "waiting on the grade" while
 * the week had in fact been graded on the Thursday.
 *
 * A single venue can still be graded or ungraded on its own screen. This is
 * just the way it is actually done.
 */
export function GradeAll({
  weekStart,
  weekLabel,
  graded,
  total,
}: {
  weekStart: string;
  weekLabel: string;
  graded: number;
  total: number;
}) {
  const [by, setBy] = useState("");
  const done = graded >= total && total > 0;

  return (
    <section
      className={`panel mb-6 ${done ? "" : "border-warn/30"}`}
      aria-label="Grade the week"
    >
      <p className="card-title">
        Week of {weekLabel} · {graded} of {total} graded
      </p>
      <p className="note text-muted mt-1 leading-relaxed">
        {done
          ? "Every venue can reset its board and take new jobs."
          : "Until a venue is graded it cannot reset its board or open the finished slots. Everything else works as normal for them."}
      </p>

      {done ? null : (
        <form
          action={gradeAllVenues}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="weekStart" value={weekStart} />
          <div className="min-w-0 flex-1">
            <label htmlFor="gradeAllBy" className="label">
              Your name
            </label>
            <input
              id="gradeAllBy"
              name="by"
              value={by}
              onChange={(event) => setBy(event.target.value)}
              autoComplete="name"
              className="field mt-1 w-full"
              placeholder="Who is grading this"
            />
          </div>
          <button type="submit" className="btn min-h-11" disabled={!by.trim()}>
            Grade the week
          </button>
        </form>
      )}
    </section>
  );
}
