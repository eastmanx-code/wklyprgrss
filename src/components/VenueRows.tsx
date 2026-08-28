import Link from "next/link";

import { Card } from "./Card";
import { tierOf } from "@/lib/status";
import type { House, HouseWeek, VenueWeekSummary } from "@/lib/types";

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

/**
 * One half's week as a row: which venue, which half, what it scored.
 *
 * Twenty-one boxes each holding two lines is a grid you have to read all of
 * before you know anything. The unit that actually gets a score is a half of a
 * venue, so that is the row, and the rows sort into the same three groups the
 * weekly report is written in.
 */
type Line = {
  venueId: string;
  code: string;
  house: House;
  score: string;
  tier: "good" | "neutral" | "fail" | null;
  ratio: number;
  /** Sent back, filed short, still in the queue — whatever is outstanding. */
  note: string;
  /**
   * The worst kind of fail, drawn loudest.
   *
   * A half with no list at all, one that filed nothing, or a venue that failed
   * everything it was scored on. Four of ten signed off is a bad week; no
   * board is not having turned up, and the two were being drawn the same.
   */
  worst: boolean;
  mine: boolean;
};

function ScoreRow({ line, href }: { line: Line; href: string }) {
  const failed = line.tier === "fail";

  return (
    <li>
      <Link
        href={href}
        /* A fail is drawn heavier than the rows around it, and the worst of
           them heavier again. At one weight for all of them, a venue that had
           lost one half read exactly like a venue that never wrote a list. */
        className={`flex flex-wrap items-baseline gap-x-3 rounded-[4px] px-3 ${
          failed
            ? `bg-warn text-on-warn hover:bg-warn/90 ${
                line.worst ? "py-4" : "py-3"
              }`
            : "hover:bg-inset bg-transparent py-2"
        }`}
      >
        <span
          /* Wider at the bigger size: a 24px code overran a 64px column and
             ran straight into the half beside it, so the worst row on the page
             read "ISFOHOH". */
          className={`shrink-0 tracking-[0.08em] ${
            line.worst ? "text-metric w-28" : "text-title w-16"
          } ${failed ? "text-on-warn" : "text-ink"}`}
        >
          {line.code}
        </span>
        <span className={`label w-8 shrink-0 ${failed ? "text-on-warn" : ""}`}>
          {line.house}
        </span>
        <span
          className={`w-16 shrink-0 tracking-normal tabular-nums ${
            line.worst ? "text-metric" : "text-title"
          } ${
            failed
              ? "text-on-warn"
              : line.tier === "neutral"
                ? "text-warn"
                : line.tier === "good"
                  ? "text-ink"
                  : "text-muted"
          }`}
        >
          {line.score}
        </span>
        <span
          className={`ml-auto shrink-0 text-right ${
            line.worst ? "card-title" : "label"
          } ${failed ? "text-on-warn" : ""}`}
        >
          {line.note}
          {line.mine ? (line.note ? " · you" : "you") : ""}
        </span>
      </Link>
    </li>
  );
}

/**
 * The ones that cleared it, as a run of codes.
 *
 * Twenty-two rows of "10/10, nothing outstanding" is the longest block on the
 * page and the one nobody opens the screen to read. It still gets said —
 * collapsing it entirely answered "what is left" and destroyed "how did we
 * do" — but it gets said in a paragraph, not a table.
 */
function GoodRun({ lines, hrefPrefix }: { lines: Line[]; hrefPrefix: string }) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="label border-divider border-t pt-4">
        Good · {lines.length}
      </p>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {lines.map((line) => (
          <Link
            key={`${line.venueId}-${line.house}`}
            href={`${hrefPrefix}${line.venueId}`}
            className="label hover:text-ink"
          >
            <span className="text-ink">{line.code}</span> {line.house}{" "}
            {line.score}
          </Link>
        ))}
      </p>
    </div>
  );
}

/** A group heading and its rows, or nothing when the group is empty. */
function Tier({
  title,
  lines,
  hrefPrefix,
}: {
  title: string;
  lines: Line[];
  hrefPrefix: string;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="label border-divider border-t pt-4">
        {title} · {lines.length}
      </p>
      <ul className="-mx-3 mt-2 space-y-[2px]">
        {lines.map((line) => (
          <ScoreRow
            key={`${line.venueId}-${line.house}`}
            line={line}
            href={`${hrefPrefix}${line.venueId}`}
          />
        ))}
      </ul>
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
   * Every half that counts, as one flat list.
   *
   * A half is what gets a score, so a half is the row. Grouped under venues,
   * the same page had to be read box by box before it said anything: a venue
   * with a good bar and a failed kitchen looked like a mixed result you had to
   * unpick, twenty-one times over.
   */
  const lines: Line[] = rows.flatMap((row) => {
    // Judged on every half it is scored on, and short on all of them. The
    // whole venue, not one side of it.
    const fullFail =
      row.scored.length > 0 &&
      row.scored.every(
        (house) =>
          Boolean(gradedBy(row.venue.id, house.house)) &&
          tierFor(house) === "fail",
      );

    return row.scored.map((house) => {
      const graded = Boolean(gradedBy(row.venue.id, house.house));
      const ruled = house.hasBoard && house.scored && house.pendingCount === 0;
      const note = [
        !house.hasBoard ? "no board" : null,
        house.pendingCount > 0 ? `${house.pendingCount} to review` : null,
        house.hasBoard && !graded ? "not graded" : null,
        house.hasBoard && house.doneCount === 0
          ? "nothing filed"
          : house.hasBoard && house.doneCount < house.activeCount
            ? `${house.doneCount} filed`
            : null,
        house.redoCount > 0 ? `${house.redoCount} sent back` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        venueId: row.venue.id,
        code: row.venue.code,
        house: house.house,
        score:
          house.hasBoard && house.scored
            ? `${house.approvedCount}/${house.activeCount}`
            : "—",
        tier: graded ? tierFor(house) : null,
        ratio:
          ruled && house.activeCount > 0
            ? house.approvedCount / house.activeCount
            : 0,
        note: fullFail
          ? [note, "whole venue"].filter(Boolean).join(" · ")
          : note,
        worst: fullFail || !house.hasBoard || house.doneCount === 0,
        mine: row.venue.id === ownVenueId,
      };
    });
  });

  // Worst first inside a group, so the top of the fails is the worst half of
  // the week and the reading order is the order of the work.
  const of = (tier: Line["tier"]) =>
    lines
      .filter((line) => line.tier === tier)
      .sort(
        (a, b) =>
          Number(b.worst) - Number(a.worst) ||
          a.ratio - b.ratio ||
          a.code.localeCompare(b.code),
      );

  const waiting = of(null);
  const fails = of("fail");
  const neutrals = of("neutral");
  const goods = of("good").reverse();

  const isAdmin = audience === "admin";
  const headline =
    waiting.length > 0
      ? `${waiting.length} still to grade`
      : fails.length > 0
        ? `${fails.length} ${fails.length === 1 ? "fail" : "fails"}`
        : isAdmin
          ? "Nothing waiting on you"
          : "Every board settled";

  return (
    <Card
      className="col-span-12"
      title="This week"
      hint={[
        `${rows.length} venues · ${lines.length} halves scored`,
        "good 8 to 10 · neutral 6 or 7 · fail 5 or under",
      ].join(" · ")}
    >
      {/* The answer, before the evidence. */}
      <p
        className={`text-metric leading-[1.15] ${
          waiting.length > 0 || fails.length > 0 ? "text-warn" : "text-ink"
        }`}
      >
        {headline}
      </p>

      <Tier title="Still to grade" lines={waiting} hrefPrefix={hrefPrefix} />
      <Tier title="Fail" lines={fails} hrefPrefix={hrefPrefix} />
      <Tier title="Neutral" lines={neutrals} hrefPrefix={hrefPrefix} />
      <GoodRun lines={goods} hrefPrefix={hrefPrefix} />
    </Card>
  );
}
