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
 *
 * Fixed width, not flex. Growing to fill the row put a 1100px barcode across a
 * desktop and shoved every number it was meant to illustrate into a jam at the
 * far edge, so the eye had to cross the whole screen to get from a venue's
 * name to its figures. Ten segments need about as much room as the word beside
 * them; past that the bar is just loud.
 */
function Segments({ done, total }: { done: number; total: number }) {
  return (
    <span className="hidden w-24 shrink-0 gap-[2px] sm:flex sm:w-32">
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
 * Where a house's week actually stands, in words.
 *
 * The screen used to answer this in colour: the approval count went yellow
 * once the week was stamped and stayed grey until then. So a venue that filed
 * ten and scored nothing, and a venue nobody had opened, both read "0" and
 * differed by a shade — and a stamped board looked identical whether every
 * item had been ruled on or none had. They are not the same fact and the
 * screen owed a word for each.
 *
 * Ordered by what needs doing, and only ever one of them: the state that
 * should pull somebody's attention wins.
 */
function state(house: HouseWeek, graded: boolean) {
  if (!house.hasBoard) return { label: "no board", tone: "warn" as const };
  if (!house.scored) return { label: "practice", tone: "muted" as const };
  if (!graded) return { label: "not graded", tone: "muted" as const };
  // Stamped, but nobody ruled on the work. The state this whole column exists
  // for: it is the one that looks finished and is not.
  if (house.pendingCount > 0) {
    return { label: `${house.pendingCount} to review`, tone: "warn" as const };
  }
  return { label: "graded", tone: "ink" as const };
}

const TONE = {
  warn: "text-warn",
  muted: "text-muted",
  ink: "text-ink",
} as const;

/**
 * One house's line inside a venue's row.
 *
 * Every column is fixed width and they sit together next to the venue code,
 * with the slack falling off the right-hand end. Stretching the middle instead
 * is what produced the jam: the numbers ended up against the window edge, a
 * different distance from their own venue on every screen.
 */
function HouseLine({
  house,
  gradedBy,
}: {
  house: HouseWeek;
  /** Who closed this house's week, or null while it is still open. */
  gradedBy: string | null;
}) {
  const here = state(house, Boolean(gradedBy));
  const complete = house.doneCount >= house.activeCount;

  return (
    <span className="flex h-6 items-center gap-2 sm:gap-3">
      <span
        className={`label w-8 shrink-0 ${house.scored ? "" : "text-muted/60"}`}
      >
        {house.house}
      </span>

      {/* Nothing to draw where there is no list. A full-length empty track
          said "filed none of ten" about a kitchen that has no ten. */}
      {/* The bar is the fraction drawn. On a phone the fraction wins: it is
          the same fact in a quarter of the room, and the room is needed by the
          column that has no other way of being said. */}
      {house.hasBoard ? (
        <Segments done={house.doneCount} total={house.activeCount} />
      ) : (
        <span className="hidden w-24 shrink-0 sm:block sm:w-32" />
      )}

      {/* Filed, then signed off. Blank rather than nought where there is no
          board, for the same reason. */}
      <span
        className={`text-body w-12 shrink-0 text-right whitespace-nowrap tracking-normal tabular-nums ${
          !house.hasBoard || !house.scored
            ? "text-muted"
            : complete
              ? "text-ink"
              : "text-warn"
        }`}
      >
        {house.hasBoard ? `${house.doneCount}/${house.activeCount}` : "—"}
      </span>

      <span
        className={`text-body hidden w-8 shrink-0 text-right tracking-normal tabular-nums min-[360px]:block ${
          house.hasBoard && house.scored ? "text-ink" : "text-muted"
        }`}
      >
        {house.hasBoard && house.scored ? house.approvedCount : "—"}
      </span>

      {/* Sent back and never replaced. Blank when there are none, so the
          column is empty on a good week and a figure in it means something. */}
      <span
        className={`text-body hidden w-8 shrink-0 text-right tracking-normal tabular-nums sm:block ${
          house.redoCount > 0 ? "text-warn" : "text-muted/40"
        }`}
      >
        {house.redoCount > 0 ? house.redoCount : ""}
      </span>

      {/* The grader's name is on the title rather than the row: it is the same
          two names down forty-two lines, so printed it was the most repeated
          text on the screen and the least informative. */}
      <span
        className={`label w-24 shrink-0 truncate sm:w-28 ${TONE[here.tone]}`}
        title={gradedBy ? `Graded by ${gradedBy}` : undefined}
      >
        {here.label}
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
/** The longer of a venue's two runs. One good half is still a run. */
function bestRun(row: VenueWeekSummary): number {
  return Math.max(0, ...row.scored.map((house) => house.winStreak));
}

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
  const gradedBy = (venueId: string, house: House) =>
    gradedByHouse?.get(house)?.get(venueId) ?? null;

  /**
   * Settled venues sink.
   *
   * Everything above the line still wants something from somebody: a board
   * that was never graded, or one that was stamped with items still waiting on
   * a verdict. A venue that is genuinely finished is the least interesting row
   * on the page and should not be sitting at the top of it.
   */
  const settled = (row: VenueWeekSummary) =>
    row.scored.every(
      (house) =>
        !house.hasBoard ||
        (Boolean(gradedBy(row.venue.id, house.house)) &&
          house.pendingCount === 0),
    );

  const active = [...rows].sort((a, b) => {
    const diff = Number(settled(a)) - Number(settled(b));
    return diff !== 0 ? diff : a.venue.code.localeCompare(b.venue.code);
  });

  const needing = active.filter((row) => !settled(row));
  const finished = active.filter(settled);

  /**
   * What is outstanding, as one sentence.
   *
   * The screen is opened to answer "am I done", and a grid of forty-two lines
   * cannot answer it: you have to read every row and hold the result in your
   * head. Twenty-one venues is forty-two lines today and only grows. So the
   * count is stated, the venues that want something are listed, and everything
   * finished collapses to a row of codes.
   */
  const toReview = needing.reduce(
    (sum, row) => sum + row.scored.reduce((n, h) => n + h.pendingCount, 0),
    0,
  );
  const ungraded = needing.reduce(
    (n, row) =>
      n +
      row.scored.filter((h) => h.hasBoard && !gradedBy(row.venue.id, h.house))
        .length,
    0,
  );

  const headline =
    needing.length === 0
      ? "Nothing waiting on you"
      : [
          toReview > 0 ? `${toReview} to review` : null,
          ungraded > 0
            ? `${ungraded} ${ungraded === 1 ? "half" : "halves"} not graded`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <>
      <Card
        className="col-span-12"
        title="This week"
        hint={
          needing.length === 0
            ? `All ${active.length} venues graded and reviewed`
            : `${needing.length} of ${active.length} venues want something`
        }
      >
        {/* The answer, before the evidence. */}
        <p
          className={`text-metric leading-[1.15] ${
            needing.length === 0 ? "text-ink" : "text-warn"
          }`}
        >
          {headline}
        </p>

        {needing.length > 0 ? (
          <>
            {/* Column names once, over the rows that follow. */}
            <div className="-mx-2 mt-6 mb-1 flex h-5 items-center gap-2 px-2 sm:gap-4">
              <span className="label w-12 shrink-0 sm:w-20">Venue</span>
              <span className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <span className="label w-8 shrink-0">Half</span>
                <span className="label hidden w-24 shrink-0 sm:block sm:w-32">
                  Filed
                </span>
                <span className="label w-12 shrink-0 text-right sm:sr-only">
                  Filed
                </span>
                <span className="label hidden w-8 shrink-0 text-right min-[360px]:block">
                  Pass
                </span>
                <span
                  className="label hidden w-8 shrink-0 text-right sm:block"
                  title="Sent back and never redone"
                >
                  Redo
                </span>
                <span className="label w-24 shrink-0 sm:w-28">Standing</span>
                <span className="min-w-0 flex-1" />
              </span>
            </div>

            <ul>
              {needing.map((row) => (
                <li key={row.venue.id} id={`venue-${row.venue.code}`}>
                  <Link
                    href={`${hrefPrefix}${row.venue.id}`}
                    className="hover:bg-hover -mx-2 flex items-center gap-2 rounded-[4px] px-2 py-2 transition-colors sm:gap-4"
                  >
                    <span className="block w-12 shrink-0 sm:w-20">
                      <span className="text-body text-ink block tracking-normal tabular-nums">
                        {row.venue.code}
                      </span>
                      {/* A run, where the venue can see its own. Weeks in a
                          row over the line, which is a thing to protect
                          rather than a position in a table. */}
                      <span className="label hidden truncate sm:block">
                        {row.failStreak > 0
                          ? `missed ${row.failStreak}w`
                          : bestRun(row) > 1
                            ? `${bestRun(row)}w run`
                            : ""}
                        {row.venue.id === ownVenueId ? " · you" : ""}
                      </span>
                    </span>

                    <span className="block min-w-0 flex-1">
                      {row.houses.map((house) => (
                        <HouseLine
                          key={house.house}
                          house={house}
                          gradedBy={gradedBy(row.venue.id, house.house)}
                        />
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {/* Finished venues are codes, not rows. Their numbers are a tap away
            and nobody is looking for them: a venue that is done is the least
            interesting thing on the page and was taking up two lines of it. */}
        {finished.length > 0 ? (
          <div className="border-divider mt-6 border-t pt-4">
            <p className="label">Done · {finished.length}</p>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
              {finished.map((row) => (
                <Link
                  key={row.venue.id}
                  href={`${hrefPrefix}${row.venue.id}`}
                  className="text-body text-muted hover:text-ink tracking-normal tabular-nums transition-colors"
                >
                  {row.venue.code}
                </Link>
              ))}
            </p>
          </div>
        ) : null}
      </Card>
    </>
  );
}
