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

  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`label w-8 shrink-0 ${house.scored ? "" : "text-muted/60"}`}
      >
        {house.house}
      </span>

      {/* Nothing to draw where there is no list. A full-length empty track
          said "filed none of ten" about a kitchen that has no ten. */}
      {house.hasBoard ? (
        <Segments done={house.doneCount} total={house.activeCount} />
      ) : (
        <span className="min-w-0 flex-1" />
      )}

      {/* Signed off, out of the ten owed. The bar beside it is what was
          filed, so the two together are the whole week in one line. */}
      <span
        className={`text-body w-10 shrink-0 text-right tracking-normal tabular-nums ${
          house.hasBoard && house.scored ? "text-ink" : "text-muted"
        }`}
      >
        {house.hasBoard && house.scored ? house.approvedCount : "—"}
      </span>

      <span
        className={`label w-32 shrink-0 truncate text-right ${TONE[here.tone]}`}
        title={gradedBy ? `Graded by ${gradedBy}` : undefined}
      >
        {here.label}
        {house.redoCount > 0 ? ` · ${house.redoCount} redo` : ""}
      </span>
    </span>
  );
}

/**
 * One venue: the code, and a line per half.
 *
 * Used for both halves of the page. A settled venue is drawn quieter but it
 * is still drawn: collapsing it to a bare code answered "what is left" and
 * destroyed "how did we do", so on the week everything got finished the card
 * went blank at exactly the moment the results became the interesting thing.
 */
function VenueCard({
  row,
  href,
  gradedBy,
  ownVenueId,
  quiet = false,
}: {
  row: VenueWeekSummary;
  href: string;
  gradedBy: (venueId: string, house: House) => string | null;
  ownVenueId: string | null;
  quiet?: boolean;
}) {
  return (
    <li id={`venue-${row.venue.code}`}>
      <Link
        href={href}
        className={`hover:ring-muted/40 block rounded-[6px] p-4 transition-shadow hover:ring-1 ${
          quiet ? "ring-divider ring-1 ring-inset" : "bg-inset"
        }`}
      >
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span
            className={`text-title tracking-[0.08em] ${
              quiet ? "text-muted" : "text-ink"
            }`}
          >
            {row.venue.code}
          </span>
          <span className="label shrink-0">
            {row.failStreak > 0
              ? `missed ${row.failStreak}w`
              : bestRun(row) > 1
                ? `${bestRun(row)}w run`
                : ""}
            {row.venue.id === ownVenueId ? " · you" : ""}
          </span>
        </div>

        <div className="space-y-2">
          {row.houses.map((house) => (
            <HouseLine
              key={house.house}
              house={house}
              gradedBy={gradedBy(row.venue.id, house.house)}
            />
          ))}
        </div>
      </Link>
    </li>
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
  audience = "leader",
}: {
  rows: VenueWeekSummary[];
  hrefPrefix: string;
  ownVenueId?: string | null;
  /** Whether the reader is the one who has to act. */
  audience?: "admin" | "leader";
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

  const isAdmin = audience === "admin";
  const headline =
    needing.length === 0
      ? isAdmin
        ? "Nothing waiting on you"
        : "Every board settled"
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
            : isAdmin
              ? `${needing.length} of ${active.length} venues want something from you`
              : `${needing.length} of ${active.length} venues still open`
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
          <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(21rem,1fr))] gap-3">
            {needing.map((row) => (
              <VenueCard
                key={row.venue.id}
                row={row}
                href={`${hrefPrefix}${row.venue.id}`}
                gradedBy={gradedBy}
                ownVenueId={ownVenueId}
              />
            ))}
          </ul>
        ) : null}

        {finished.length > 0 ? (
          <div className={needing.length > 0 ? "mt-8" : "mt-6"}>
            <p className="label border-divider border-t pt-4">
              Done · {finished.length}
            </p>
            <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(21rem,1fr))] gap-3">
              {finished.map((row) => (
                <VenueCard
                  key={row.venue.id}
                  row={row}
                  href={`${hrefPrefix}${row.venue.id}`}
                  gradedBy={gradedBy}
                  ownVenueId={ownVenueId}
                  quiet
                />
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </>
  );
}
