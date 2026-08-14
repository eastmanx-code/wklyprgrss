import Link from "next/link";

import { Card } from "./Card";
import { formatFinish } from "@/lib/week";
import type { VenueWeekSummary } from "@/lib/types";

/**
 * Ten discrete segments, not a continuous fill.
 *
 * The metric is ten photos, so the bar should be countable: at 1/10 a
 * continuous fill is an unreadable sliver, while one lit segment out of ten
 * reads instantly. Fill is always white — the alert colour is reserved for
 * past due, failing and missed-week runs, and a yellow progress bar would say
 * "progress is bad".
 */
function Segments({ done, total }: { done: number; total: number }) {
  return (
    <span className="flex min-w-0 flex-1 gap-[2px]">
      {Array.from({ length: Math.max(total, 1) }, (_, i) => (
        <span
          key={i}
          className={`h-2 flex-1 rounded-[1px] ${
            i < done ? "bg-ink" : "bg-inset"
          }`}
        />
      ))}
    </span>
  );
}

/**
 * The all-venues list.
 *
 * Venues with no board used to collapse into a separate strip of code chips,
 * on the reasoning that an empty track implied progress had been possible.
 * That reasoning excused the worst case in the programme: a venue that never
 * built its ten is not outside the scoring, it is the bottom of it. Every
 * venue is on one list, measured against the same ten.
 *
 * The two pages are the same view of the same week; the only difference is
 * where a row leads — the board to a read-only venue, admin to the screen with
 * approve and send-back on it.
 */
export function VenueRows({
  rows,
  hrefPrefix,
  ownVenueId = null,
  finishedAt = {},
  gradedVenueIds,
}: {
  rows: VenueWeekSummary[];
  hrefPrefix: string;
  ownVenueId?: string | null;
  /** venue code -> when it reached ten, for the venues that got there. */
  finishedAt?: Record<string, string>;
  /** Venues whose week has been closed out. */
  gradedVenueIds?: Set<string>;
}) {
  const active = rows;

  return (
    <>
      {active.length > 0 ? (
        <Card
          className="col-span-12"
          title="This week"
          hint="Updated is a new photo and comment · grade is what was signed off, in colour once the week is closed"
        >
          {/* Name the columns once, rather than on every row.
              Two numbers sit on each row now and they mean different things —
              what the venue filed, and what has been signed off — so run
              together as "10/10 · 10 SIGNED OFF" they read as one figure with
              a suffix. Headed, the words come off the rows entirely: the
              tally is a bare number under APPROVED, and twenty-one of them
              make a column you can read down. */}
          <div className="mb-1 flex h-5 items-center gap-4 px-2">
            <span className="label w-16 shrink-0">Venue</span>
            <span className="min-w-0 flex-1" />
            <span className="label hidden w-24 shrink-0 text-right sm:block">
              Last in
            </span>
            <span className="label w-20 shrink-0 text-center">Grade</span>
            <span className="label w-16 shrink-0 text-right">Updated</span>
          </div>

          <ul>
            {active.map((row) => {
              const finished = finishedAt[row.venue.code];
              const graded = gradedVenueIds?.has(row.venue.id) ?? false;
              return (
                <li key={row.venue.id} id={`venue-${row.venue.code}`}>
                  <Link
                    href={`${hrefPrefix}${row.venue.id}`}
                    className="hover:bg-hover -mx-2 flex h-10 items-center gap-4 rounded-[4px] px-2 transition-colors"
                  >
                    <span className="text-body text-ink w-16 shrink-0 tracking-normal tabular-nums">
                      {row.venue.code}
                    </span>

                    {/* The work, not the paperwork. This measured approvals,
                        so before a review pass every venue in the company read
                        0/10 — a week where 183 cards were filed looked like a
                        week where nobody moved. What a crew did is the photo
                        and the comment; signing off is the admin's job and
                        belongs second. */}
                    <Segments done={row.doneCount} total={row.activeCount} />

                    {/* Meta gets its own column. Folded into the 72px count
                        it wrapped to a second line and broke the 40px row —
                        "THU 5:36 PM" is eleven characters in a slot that fits
                        about eight. Hidden on phones, where the count and the
                        bar are the whole story. */}
                    <span className="label hidden w-24 shrink-0 truncate text-right sm:block">
                      {finished
                        ? formatFinish(finished)
                        : row.failStreak > 0
                          ? `missed ${row.failStreak}w`
                          : ""}
                      {row.venue.id === ownVenueId ? " · you" : ""}
                    </span>

                    {/* The sign-off tally is its own column too, for the same
                        reason. Run together with the count it made a 160px
                        blob that started in a different place on every row —
                        "10/10", "10/10 · 10 SIGNED OFF", "4/10" — so no two
                        fractions lined up and the eye had to read each one
                        rather than scan the column.

                        The biggest number on the row, because it is the one
                        being scanned. It sat in a chip before, and the chip
                        was doing two jobs while only one of them was needed:
                        the header already says this figure is a grade, and
                        the accent already separates it from the white count
                        beside it. What the box cost was room — a digit forced
                        down to the 11px label role with the letter-spacing
                        that role carries, which is type meant for words like
                        MISSED 2W, not for twenty-one numbers read in a
                        column.

                        It shows what was signed off, and the colour shows
                        whether the week was closed at all. Those are two
                        different facts and printing only the first hid the
                        second: a venue whose every task was sent back has
                        nothing signed off, so a closed-out review of a
                        failing venue read exactly like a venue nobody had
                        opened. Every row carries a figure now — muted while
                        the review is still open, accent once it is graded.

                        Kept on a phone, unlike the timestamp beside it. The
                        bar loses eighty pixels and still has ten legible
                        segments, and the whole point of the column is that it
                        is visible where the reviewing actually happens. */}
                    <span
                      className={`w-20 shrink-0 text-center text-title tracking-normal tabular-nums ${
                        graded ? "text-warn" : "text-muted"
                      }`}
                    >
                      {row.approvedCount}
                    </span>

                    <span
                      className={`text-body w-16 shrink-0 text-right whitespace-nowrap tracking-normal tabular-nums ${
                        row.doneCount >= row.activeCount
                          ? "text-ink"
                          : "text-warn"
                      }`}
                    >
                      {row.doneCount}/{row.activeCount}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

    </>
  );
}
