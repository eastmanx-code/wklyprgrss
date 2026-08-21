import Link from "next/link";

import { Card } from "./Card";
import { formatFinish } from "@/lib/week";
import type { House, HouseWeek, VenueWeekSummary } from "@/lib/types";

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
 * One house's line inside a venue's row: which half, how it is going, what has
 * been signed off, and the count.
 *
 * A house still being walked for practice is drawn, because leaving it out
 * would say the kitchen does not exist — but its numbers are held back to the
 * muted role and labelled, so nobody reads a practice run as a score.
 */
function HouseLine({
  house,
  graded,
  finishedAt,
}: {
  house: HouseWeek;
  graded: boolean;
  /** When this house got its tenth photo, if it got there. */
  finishedAt?: string;
}) {
  const complete = house.doneCount >= house.activeCount;
  return (
    <span className="flex h-6 items-center gap-3">
      <span
        className={`label w-8 shrink-0 ${house.scored ? "" : "text-muted/60"}`}
      >
        {house.house}
      </span>

      {/* The work, not the paperwork. This measured approvals, so before a
          review pass every venue in the company read 0/10 — a week where 183
          cards were filed looked like a week where nobody moved. What a crew
          did is the photo and the comment; signing off is the admin's job and
          belongs second. */}
      <Segments done={house.doneCount} total={house.activeCount} />

      {/* What was signed off, and — in colour — whether the week was closed
          at all. Those are two different facts and printing only the first hid
          the second: a venue whose every task was sent back has nothing signed
          off, so a closed-out review of a failing venue read exactly like a
          venue nobody had opened. */}
      <span
        className={`text-body w-10 shrink-0 text-center tracking-normal tabular-nums ${
          graded && house.scored ? "text-warn" : "text-muted"
        }`}
      >
        {house.scored ? house.approvedCount : "—"}
      </span>

      <span
        className={`text-body w-12 shrink-0 text-right whitespace-nowrap tracking-normal tabular-nums ${
          !house.scored ? "text-muted" : complete ? "text-ink" : "text-warn"
        }`}
      >
        {house.doneCount}/{house.activeCount}
      </span>

      {/* When this half finished, on this half's own line.
      
          It used to sit once under the venue code, described as "one fact
          about the venue rather than about either walk" — which stopped being
          true the moment there were two walks. It was front of house's time,
          printed as the venue's, so a dining room finished Monday and a
          kitchen finished Thursday both read as Monday.
      
          Off on phones, where the bars and the counts are the whole story:
          "THU 5:36 PM" is eleven characters in a slot that fits about five. */}
      <span className="label hidden w-20 shrink-0 text-right whitespace-nowrap sm:block">
        {finishedAt ? formatFinish(finishedAt) : ""}
      </span>
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
  finishesByHouse = [],
  gradedByHouse,
}: {
  rows: VenueWeekSummary[];
  hrefPrefix: string;
  ownVenueId?: string | null;
  /**
   * When each venue finished each house. Per house, because the two halves
   * finish at different times and the later one used to swallow the earlier.
   */
  finishesByHouse?: {
    house: House;
    finishes: { code: string; at: string }[];
  }[];
  /**
   * Venues whose week has been closed out, per house. Two people grade, so one
   * set covering both would have shown the kitchen signed off because the
   * dining room was.
   */
  gradedByHouse?: Map<House, Set<string>>;
}) {
  const active = rows;
  /** code|house -> the moment that half's tenth task got a photograph. */
  const finishedAt = new Map(
    finishesByHouse.flatMap((entry) =>
      entry.finishes.map((f) => [`${f.code}|${entry.house}`, f.at] as const),
    ),
  );

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
            <span className="label w-14 shrink-0 sm:w-20">Venue</span>
            {/* Mirrors a house line exactly — same widths, same gap — so the
                headings sit over the columns rather than near them. */}
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span className="label w-8 shrink-0">Half</span>
              <span className="min-w-0 flex-1" />
              <span className="label w-10 shrink-0 text-center">Grade</span>
              <span className="label w-12 shrink-0 text-right">Updated</span>
              <span className="label hidden w-20 shrink-0 text-right sm:block">
                Finished
              </span>
            </span>
          </div>

          <ul>
            {active.map((row) => (
              <li key={row.venue.id} id={`venue-${row.venue.code}`}>
                <Link
                  href={`${hrefPrefix}${row.venue.id}`}
                  className="hover:bg-hover -mx-2 flex items-center gap-4 rounded-[4px] px-2 py-2 transition-colors"
                >
                  <span className="block w-14 shrink-0 sm:w-20">
                    <span className="text-body text-ink block tracking-normal tabular-nums">
                      {row.venue.code}
                    </span>
                    {/* What is left under the code is the only thing here
                          that really is one fact about the venue: how long it
                          has been missing weeks. The finishing time moved onto
                          the house lines, where there is one per walk. */}
                    <span className="label hidden truncate sm:block">
                      {row.failStreak > 0 ? `missed ${row.failStreak}w` : ""}
                      {row.venue.id === ownVenueId ? " · you" : ""}
                    </span>
                  </span>

                  {/* One line per house, never one line for both.
                        Summed into a single twenty-segment bar, a spotless
                        dining room would have filled half of it and read as
                        real progress at a venue whose kitchen had not been
                        walked at all — which is the whole reason the board
                        was split. */}
                  {/* `block`, not the default inline. As an inline box this
                        wrapper shrank to fit its content, and the flex-1 on
                        each house's bar inside it had no definite width to
                        grow into — every progress bar in the company rendered
                        at zero pixels and the column looked empty. */}
                  <span className="block min-w-0 flex-1">
                    {row.houses.map((house) => (
                      <HouseLine
                        key={house.house}
                        house={house}
                        graded={
                          gradedByHouse?.get(house.house)?.has(row.venue.id) ??
                          false
                        }
                        finishedAt={finishedAt.get(
                          `${row.venue.code}|${house.house}`,
                        )}
                      />
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
