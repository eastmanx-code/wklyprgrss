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
 * The all-venues list, split by whether a venue has anything to walk yet.
 *
 * Venues with no items collapse to code chips rather than rows: twenty-four
 * empty tracks imply progress was possible this week, and chips say "not
 * started" honestly.
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
}: {
  rows: VenueWeekSummary[];
  hrefPrefix: string;
  ownVenueId?: string | null;
  /** venue code -> when it reached ten, for the venues that got there. */
  finishedAt?: Record<string, string>;
}) {
  const active = rows.filter((row) => row.status !== "SETUP");
  const notSetUp = rows.filter((row) => row.status === "SETUP");

  return (
    <>
      {active.length > 0 ? (
        <Card
          className="col-span-12"
          title="This week"
          hint="Updated is a new photo and comment · approved is signed off after review"
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
            <span className="label w-20 shrink-0 text-right">Approved</span>
            <span className="label w-16 shrink-0 text-right">Updated</span>
          </div>

          <ul>
            {active.map((row) => {
              const finished = finishedAt[row.venue.code];
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

                        Marked, not just printed. Every other figure on this
                        screen is something a venue filed; this one is a
                        decision that was made about it, and a plain number in
                        the same weight as its neighbour says the two are the
                        same kind of thing. The chip is the app's existing
                        done mark — not the alert colour, which here means
                        past due, short, missed. A grade is not a warning.

                        Empty until reviewed, so Monday to Thursday the column
                        is blank and the board stays quiet, then fills in as
                        the week is graded.

                        Kept on a phone, unlike the timestamp beside it. The
                        bar loses eighty pixels and still has sixteen per
                        segment, and the whole point of the column is that it
                        is visible where the reviewing actually happens. */}
                    <span className="flex w-20 shrink-0 justify-end">
                      {row.approvedCount > 0 ? (
                        <span className="pill pill-done min-w-9 justify-center tabular-nums">
                          {row.approvedCount}
                        </span>
                      ) : null}
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

      {notSetUp.length > 0 ? (
        <Card
          className="col-span-12"
          title="No board yet"
          hint="Nothing set up, so nothing to miss"
        >
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {notSetUp.map((row) => (
              <li key={row.venue.id} id={`venue-${row.venue.code}`}>
                <Link
                  href={`${hrefPrefix}${row.venue.id}`}
                  className="bg-inset hover:bg-hover text-body text-muted flex h-10 items-center justify-center rounded-[4px] tracking-normal transition-colors"
                >
                  {row.venue.code}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
