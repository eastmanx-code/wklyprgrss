"use client";

import { useRef, useState } from "react";

import { gradeAllVenues } from "@/app/admin/actions";
import type { House } from "@/lib/types";
import { houseName } from "@/lib/types";

export type HouseGradeCount = { house: House; graded: number };

/**
 * Closing the week for everyone, in one move per house.
 *
 * Grading venue by venue is twenty-one taps of bookkeeping on top of the review
 * that already happened — and the first week it existed it was missed
 * altogether, so every board in the company read "waiting on the grade" while
 * the week had in fact been graded on the Thursday.
 *
 * One button per house, not one for both: the two walks are done by two people,
 * and a single button would have put whoever pressed it against a walk they did
 * not do. A single venue can still be graded or ungraded on its own screen.
 */
export function GradeAll({
  weekStart,
  weekLabel,
  houses,
  total,
}: {
  weekStart: string;
  weekLabel: string;
  /** The houses being scored this week, and how many venues are closed out. */
  houses: HouseGradeCount[];
  total: number;
}) {
  const [by, setBy] = useState("");
  // Same reasoning as GradeWeek: one name box, several forms, so the check
  // lives here rather than in a button that greys out and says nothing.
  const [needName, setNeedName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  function requireName(event: React.FormEvent<HTMLFormElement>) {
    if (by.trim()) return;
    event.preventDefault();
    setNeedName(true);
    nameRef.current?.focus();
  }

  const outstanding = houses.filter((house) => house.graded < total);
  const done = outstanding.length === 0 && total > 0;

  return (
    <section
      className={`panel mb-6 ${done ? "" : "border-warn/30"}`}
      aria-label="Grade the week"
    >
      <p className="card-title">
        Week of {weekLabel} ·{" "}
        {houses
          .map(
            (house) =>
              `${houseName(house.house).toLowerCase()} ${house.graded}/${total}`,
          )
          .join(" · ")}
      </p>
      <p className="note text-muted mt-1 leading-relaxed">
        {done
          ? "Every venue can reset its board and take new jobs."
          : "A venue cannot reset its board until both halves are graded. Everything else works as normal for them."}
      </p>

      {done ? null : (
        <>
          <div className="mt-4">
            <label htmlFor="gradeAllBy" className="label">
              Your name
            </label>
            <input
              id="gradeAllBy"
              ref={nameRef}
              value={by}
              onChange={(event) => {
                setBy(event.target.value);
                if (needName) setNeedName(false);
              }}
              autoComplete="name"
              className="field mt-1 w-full"
              placeholder="Who is grading this"
              aria-invalid={needName}
            />
            {needName ? (
              <p role="alert" className="text-body text-warn mt-2">
                Put your name in before you grade. It goes on the record.
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {outstanding.map((house) => (
              <form
                key={house.house}
                action={gradeAllVenues}
                onSubmit={requireName}
              >
                <input type="hidden" name="weekStart" value={weekStart} />
                <input type="hidden" name="house" value={house.house} />
                <input type="hidden" name="by" value={by} />
                <button type="submit" className="btn min-h-11">
                  Grade {houseName(house.house).toLowerCase()} · all venues
                </button>
              </form>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
