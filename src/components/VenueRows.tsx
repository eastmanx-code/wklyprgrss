import Link from "next/link";

import { Card } from "./Card";
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
  gradedBy,
}: {
  house: HouseWeek;
  /** Who closed this house's week, or null while it is still open. */
  gradedBy: string | null;
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

      {/* What was signed off. Just the count now — whether the week was
          closed at all has its own column, because the two were sharing this
          cell with the state carried in colour, and a grey nought and a
          yellow nought are not far enough apart to mean "nobody has looked at
          this" and "we looked, it scored nothing". */}
      <span
        className={`text-body w-10 shrink-0 text-center tracking-normal tabular-nums ${
          house.scored ? "text-ink" : "text-muted"
        }`}
      >
        {house.scored ? house.approvedCount : "—"}
      </span>

      {/* Hidden on a phone, where the bar beside it says the same thing:
          it is lit segments out of ten, which is what this counts. The graded
          column took its place because that one has no other way of being
          seen, and a screen that cannot say whether anybody has ruled on the
          week is missing the fact people open it for. */}
      <span
        className={`text-body hidden w-12 shrink-0 text-right whitespace-nowrap tracking-normal tabular-nums sm:block ${
          !house.scored ? "text-muted" : complete ? "text-ink" : "text-warn"
        }`}
      >
        {house.doneCount}/{house.activeCount}
      </span>

      {/* Whether anybody has ruled on this, said in words.
          A name answers it and says who to ask, and cannot be misread as a
          score. A house being walked for practice has no grade to wait for,
          so it says that rather than looking overdue. */}
      <span
        className={`label w-16 shrink-0 truncate text-right sm:w-24 ${
          gradedBy ? "text-ink" : "text-muted"
        }`}
      >
        {!house.scored ? "practice" : (gradedBy ?? "not yet")}
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
  gradedByHouse,
}: {
  rows: VenueWeekSummary[];
  hrefPrefix: string;
  ownVenueId?: string | null;
  /**
   * Who closed out each house's week, per venue. Two people grade, so one map
   * covering both would have shown the kitchen signed off because the dining
   * room was.
   */
  gradedByHouse?: Map<House, Map<string, string>>;
}) {
  const active = rows;

  return (
    <>
      {active.length > 0 ? (
        <Card
          className="col-span-12"
          title="This week"
          hint="Signed off is how many passed · updated is a new photo and comment · graded names whoever closed the week out"
        >
          {/* Name the columns once, rather than on every row.
              Two numbers sit on each row now and they mean different things —
              what the venue filed, and what has been signed off — so run
              together as "10/10 · 10 SIGNED OFF" they read as one figure with
              a suffix. Headed, the words come off the rows entirely: the
              tally is a bare number under APPROVED, and twenty-one of them
              make a column you can read down. */}
          {/* Same box as a row, negative margin included. The rows pull out by
              8px so their hover fill bleeds past the text, and a header that
              only had the padding sat 8px inside them — every label a little
              left of its own column. */}
          <div className="mb-1 -mx-2 flex h-5 items-center gap-4 px-2">
            <span className="label w-14 shrink-0 sm:w-20">Venue</span>
            {/* Mirrors a house line exactly — same widths, same gap — so the
                headings sit over the columns rather than near them. */}
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span className="label w-8 shrink-0">Half</span>
              <span className="min-w-0 flex-1" />
              <span className="label w-10 shrink-0 text-center">Signed</span>
              <span className="label hidden w-12 shrink-0 text-right sm:block">
                Updated
              </span>
              <span className="label w-16 shrink-0 text-right sm:w-24">
                Graded by
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
                    {/* How long it has been missing weeks, which is the one
                        thing here that really is a fact about the venue.
                        The finishing time used to sit here as well: it was
                        front of house's, printed as the venue's, and per house
                        it made a ragged column of twenty-one timestamps that
                        crowded the counts. First and last in are on each
                        house's band above, where they say something. */}
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
                        gradedBy={
                          gradedByHouse?.get(house.house)?.get(row.venue.id) ??
                          null
                        }
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
