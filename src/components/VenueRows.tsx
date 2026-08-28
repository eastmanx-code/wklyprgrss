import Link from "next/link";

import { Card } from "./Card";
import { tierOf } from "@/lib/status";
import type { House, HouseWeek, VenueWeekSummary } from "@/lib/types";

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
/**
 * What this half scored, once every card in it has been ruled on.
 *
 * Good, neutral or fail, on the weekly report's own bands. Null while the
 * half is unbuilt, unscored, or still has cards waiting on a verdict, which
 * are all states with no score yet rather than a bad one.
 */
export function tierFor(house: HouseWeek): "good" | "neutral" | "fail" | null {
  if (!house.scored || house.pendingCount > 0) return null;
  // A half with no list at all is the bottom of the scoring, not outside it,
  // and the house totals have always counted it that way. Held back here, one
  // venue was drawn as a neutral on the strength of its dining room while its
  // kitchen had never written a board.
  if (!house.hasBoard) return "fail";
  return tierOf(house.approvedCount, house.activeCount);
}

function state(house: HouseWeek, graded: boolean) {
  if (!house.hasBoard) return { label: "no board", tone: "warn" as const };
  if (!house.scored) return { label: "practice", tone: "muted" as const };
  if (!graded) return { label: "not graded", tone: "muted" as const };
  // Stamped, but nobody ruled on the work. The state this whole column exists
  // for: it is the one that looks finished and is not.
  if (house.pendingCount > 0) {
    return { label: `${house.pendingCount} to review`, tone: "warn" as const };
  }
  // Nothing. The line already says 6/10 and 4 sent back, in the words the
  // crew is given them in, and a verdict word on top of that was either
  // inventing vocabulary this screen alone used — "passed", "missed" — or,
  // once it was cut back to the honest one, printing "approved" forty times
  // down a page where every line said it.
  //
  // Whether the half cleared the line is the number against the ten and the
  // colour of the card. This column is for the states a number cannot say.
  return { label: "", tone: "ink" as const };
}

const TONE = {
  warn: "text-warn",
  muted: "text-muted",
  ink: "text-ink",
} as const;

/**
 * One house's week, in the terms the week is actually discussed in.
 *
 * It used to lead with a ten-segment bar of what had been filed. On a normal
 * week every venue files all ten, so twenty-one cards each carried an
 * identical black block taking the widest column on the card and telling
 * nobody anything, while the fact that decides the week — how much of it was
 * signed off — sat beside it as a bare "8" with no denominator. You had to
 * already know the rule to read the card.
 *
 * So the score leads, out of the ten it is out of, and filing only gets a word
 * when it fell short, which is the rare case worth the ink.
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
  const scored = house.hasBoard && house.scored;
  const tier = tierFor(house);
  const failed = tier === "fail";

  // The exceptions, and only the exceptions. A half that filed its ten and had
  // none sent back says nothing here at all.
  const trailer = [
    house.hasBoard && house.doneCount < house.activeCount
      ? `${house.doneCount} filed`
      : null,
    house.redoCount > 0 ? `${house.redoCount} sent back` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span
      className={`-mx-2 flex flex-wrap items-baseline gap-x-3 rounded-[3px] px-2 py-1 ${
        failed ? "bg-warn text-on-warn" : ""
      }`}
    >
      <span
        className={`label w-8 shrink-0 ${
          failed ? "text-on-warn" : house.scored ? "" : "text-muted/60"
        }`}
      >
        {house.house}
      </span>

      <span
        className={`text-title w-16 shrink-0 tracking-normal tabular-nums ${
          failed
            ? "text-on-warn"
            : !scored
              ? "text-muted"
              : tier === "neutral"
                ? "text-warn"
                : "text-ink"
        }`}
      >
        {scored ? `${house.approvedCount}/${house.activeCount}` : "—"}
      </span>

      {/* The states a number cannot say, then the exceptions. Long ones drop
          to their own line rather than being cut off: "8 filed · 4 sent back"
          wants 157px and had 114. */}
      <span
        className={`label shrink-0 ${failed ? "text-on-warn" : TONE[here.tone]}`}
        title={gradedBy ? `Graded by ${gradedBy}` : undefined}
      >
        {here.label}
      </span>

      <span
        className={`label ml-auto shrink-0 text-right ${
          failed ? "text-on-warn/80" : ""
        }`}
      >
        {trailer}
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
    <li className="h-full" id={`venue-${row.venue.code}`}>
      <Link
        href={href}
        /* The card stays a card. Colouring the whole box by its worst half
           drew a venue with a perfect dining room and a failed kitchen exactly
           like one that failed both, and the half that was good disappeared
           into the fill. The colour belongs on the half it is about. */
        className={`flex h-full flex-col rounded-[6px] p-4 transition-shadow ${
          quiet
            ? "ring-divider hover:ring-muted/40 ring-1 ring-inset"
            : "bg-inset hover:ring-muted/40 hover:ring-1"
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
          {/* Only the run. The missed-weeks badge counted earlier weeks and
              printed them on a card about this one, so a venue that filed
              everything this week still read as having missed. */}
          <span className="label shrink-0">
            {row.runWeeks > 1 ? `${row.runWeeks} weeks clean` : ""}
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
 * What the colours mean, since nothing else says it.
 *
 * The line is two numbers now and no verdict word, so the card's fill is
 * carrying the result on its own. A convention doing that much work has to be
 * written down somewhere, and one row of swatches is the whole of it.
 */
function ColourKey() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="bg-warn text-on-warn label rounded-[3px] px-2 py-1">
        Fail · 5 or under
      </span>
      <span className="label text-warn">Neutral · 6 or 7</span>
      <span className="label text-ink">Good · 8 to 10</span>
    </div>
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
        hint={[
          needing.length === 0
            ? `All ${active.length} venues graded and reviewed`
            : isAdmin
              ? `${needing.length} of ${active.length} venues want something from you`
              : `${needing.length} of ${active.length} venues still open`,
          "the score is what was signed off, out of 10",
        ].join(" · ")}
      >
        {/* The answer, before the evidence. */}
        <p
          className={`text-metric leading-[1.15] ${
            needing.length === 0 ? "text-ink" : "text-warn"
          }`}
        >
          {headline}
        </p>

        <ColourKey />

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
