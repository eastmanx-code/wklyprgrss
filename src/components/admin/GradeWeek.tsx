"use client";

import { useState } from "react";

import { gradeWeek, ungradeWeek } from "@/app/admin/actions";

/**
 * Closing a week for a venue.
 *
 * Leaders were told reset comes "once graded", and until now nothing in the app
 * meant graded — Reset Board appeared the moment a single task was approved, so
 * a venue could clear its board before the week had been looked at as a whole.
 * This is the act they are waiting on.
 *
 * It takes a name. A grade is somebody's judgement of somebody else's week, and
 * the venue on the receiving end should be able to see whose.
 */
export function GradeWeek({
  venueId,
  weekStart,
  weekLabel,
  gradedBy,
}: {
  venueId: string;
  weekStart: string;
  weekLabel: string;
  gradedBy: string | null;
}) {
  const [by, setBy] = useState("");

  if (gradedBy) {
    return (
      <section className="panel mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="card-title">Week of {weekLabel} · graded</p>
            <p className="note text-muted mt-1">
              By {gradedBy}. This venue can reset its board.
            </p>
          </div>
          <form action={ungradeWeek} className="shrink-0">
            <input type="hidden" name="venueId" value={venueId} />
            <input type="hidden" name="weekStart" value={weekStart} />
            <button type="submit" className="btn-ghost min-h-11">
              Undo grade
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="panel border-warn/30 mb-6">
      <p className="card-title">Week of {weekLabel} · not graded</p>
      <p className="note text-muted mt-1 leading-relaxed">
        Until this is graded the venue cannot reset its board or take new jobs
        into the finished slots. Everything else works as normal for them.
      </p>
      <form action={gradeWeek} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="venueId" value={venueId} />
        <input type="hidden" name="weekStart" value={weekStart} />
        <div className="min-w-0 flex-1">
          <label htmlFor="gradeBy" className="label">
            Your name
          </label>
          <input
            id="gradeBy"
            name="by"
            value={by}
            onChange={(event) => setBy(event.target.value)}
            autoComplete="name"
            className="field mt-1 w-full"
            placeholder="Who is grading this"
          />
        </div>
        <button type="submit" className="btn min-h-11" disabled={!by.trim()}>
          Grade this week
        </button>
      </form>
    </section>
  );
}
