"use client";

import { useRef, useState } from "react";

import { gradeWeek, ungradeWeek } from "@/app/admin/actions";
import type { House } from "@/lib/types";
import { houseName } from "@/lib/types";

export type HouseGrade = {
  house: House;
  gradedBy: string | null;
  /** False while the house is still being walked for practice. */
  scored: boolean;
};

/**
 * Closing a week for a venue, one house at a time.
 *
 * Leaders were told reset comes "once graded", and until this existed nothing
 * in the app meant graded — Reset Board appeared the moment a single task was
 * approved, so a venue could clear its board before the week had been looked at
 * as a whole. This is the act they are waiting on.
 *
 * Two people walk now, one per house, and each signs their own line. Graded as
 * one, whoever finished second would have overwritten the first: the record
 * would have shown one name and silently lost the other, and a venue could have
 * been told its kitchen was signed off by someone who never entered it.
 *
 * The name is typed once and used by whichever line is submitted — the two
 * walks are usually minutes apart, and asking for it twice is asking the same
 * person the same question.
 */
export function GradeWeek({
  venueId,
  weekStart,
  weekLabel,
  houses,
}: {
  venueId: string;
  weekStart: string;
  weekLabel: string;
  houses: HouseGrade[];
}) {
  const [by, setBy] = useState("");
  /**
   * The name box lives outside these forms, because one name covers whichever
   * half is submitted. That puts it beyond the browser's own validation, so
   * the check is here — and it is a check rather than a disabled button on
   * purpose. A greyed-out control that gives no reason is the thing that had a
   * leader messaging to ask what was broken.
   */
  const [needName, setNeedName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  function requireName(event: React.FormEvent<HTMLFormElement>) {
    if (by.trim()) return;
    event.preventDefault();
    setNeedName(true);
    nameRef.current?.focus();
  }

  const scored = houses.filter((house) => house.scored);
  const outstanding = scored.filter((house) => !house.gradedBy);
  const done = outstanding.length === 0 && scored.length > 0;

  return (
    <section className={`panel mb-6 ${done ? "" : "border-warn/30"}`}>
      <p className="card-title">
        Week of {weekLabel} ·{" "}
        {done
          ? "graded"
          : `${scored.length - outstanding.length} of ${scored.length} graded`}
      </p>
      <p className="note text-muted mt-1 leading-relaxed">
        {done
          ? "This venue can reset its board."
          : "Until every half is graded the venue cannot reset its board or take new jobs into the finished slots. Everything else works as normal for them."}
      </p>

      {outstanding.length > 0 ? (
        <div className="mt-4">
          <label htmlFor="gradeBy" className="label">
            Your name
          </label>
          <input
            id="gradeBy"
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
      ) : null}

      <ul className="mt-4 space-y-2">
        {scored.map((house) => (
          <li
            key={house.house}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="note min-w-0">
              {houseName(house.house)}
              {house.gradedBy ? (
                <span className="text-muted">
                  {" "}
                  · graded by {house.gradedBy}
                </span>
              ) : (
                <span className="text-warn"> · not graded</span>
              )}
            </p>

            {house.gradedBy ? (
              <form action={ungradeWeek} className="shrink-0">
                <input type="hidden" name="venueId" value={venueId} />
                <input type="hidden" name="weekStart" value={weekStart} />
                <input type="hidden" name="house" value={house.house} />
                <button type="submit" className="btn-ghost min-h-11">
                  Undo
                </button>
              </form>
            ) : (
              <form
                action={gradeWeek}
                onSubmit={requireName}
                className="shrink-0"
              >
                <input type="hidden" name="venueId" value={venueId} />
                <input type="hidden" name="weekStart" value={weekStart} />
                <input type="hidden" name="house" value={house.house} />
                <input type="hidden" name="by" value={by} />
                <button type="submit" className="btn min-h-11">
                  Grade {houseName(house.house).toLowerCase()}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
