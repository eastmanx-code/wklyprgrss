import Link from "next/link";

import { Card } from "./Card";
import { tierOf } from "@/lib/status";
import {
  HOUSES,
  houseName,
  type House,
  type HouseWeek,
  type VenueWeekSummary,
} from "@/lib/types";

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
  /** Filed and owed this week, for the filing view before the deadline. */
  filed: number;
  target: number;
  hasBoard: boolean;
  /** Filed then rejected, so the newest photo is the sent-back one. */
  sentBack: number;
  /** Sent back, filed short, still in the queue — whatever is outstanding. */
  note: string;
  /**
   * The worst kind of fail, sorted to the top of its group.
   *
   * A half with no list at all, one that filed nothing, or a venue that failed
   * everything it was scored on. Four of ten signed off is a bad week; no
   * board is not having turned up. Order says so — the bars stay one size.
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
        /* One bar, one height, whatever it scored. Drawing the worst fails
           double height made the block a stack of different objects and cost
           the eye the thing it was scanning for, which is the column of
           numbers down the left. Order carries severity instead. */
        className={`bg-inset flex flex-wrap items-baseline gap-x-3 rounded-[4px] px-3 py-3 ${
          failed
            ? "bg-warn text-on-warn hover:bg-warn/90"
            : "hover:ring-muted/30 hover:ring-1 hover:ring-inset"
        }`}
      >
        <span
          className={`text-title w-16 shrink-0 tracking-[0.08em] ${
            failed ? "text-on-warn" : "text-ink"
          }`}
        >
          {line.code}
        </span>
        <span className={`label w-8 shrink-0 ${failed ? "text-on-warn" : ""}`}>
          {line.house}
        </span>
        <span
          className={`text-title w-16 shrink-0 tracking-normal tabular-nums ${
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
          className={`label ml-auto shrink-0 text-right ${
            failed ? "text-on-warn" : ""
          }`}
        >
          {line.note}
          {line.mine ? (line.note ? " · you" : "you") : ""}
        </span>
      </Link>
    </li>
  );
}

/**
 * A filing row: who has put photos in, with the ten drawn as a bar so the room
 * reads at a glance. Filed in ink, sent back in the one warn, the rest a faint
 * track. No fail styling — nothing is graded before the deadline.
 */
function FilingRow({ line, href }: { line: Line; href: string }) {
  const filedOk = Math.max(0, line.filed - line.sentBack);
  const notFiled = Math.max(0, line.target - line.filed);
  const segments = [
    { label: "Filed", value: filedOk, fill: "var(--ink)", opacity: 1 },
    { label: "Sent back", value: line.sentBack, fill: "var(--warn)", opacity: 1 },
    // A visible grey, not the faint track, so the board's end reads.
    { label: "Not filed", value: notFiled, fill: "var(--ink)", opacity: 0.18 },
  ];
  return (
    <li>
      <Link
        href={href}
        title={`${line.code} ${line.house} · ${line.filed} of ${line.target} filed`}
        className="bg-inset hover:ring-muted/30 block rounded-[4px] px-3 py-3 hover:ring-1 hover:ring-inset"
      >
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-title text-ink w-16 shrink-0 tracking-[0.08em]">
            {line.code}
          </span>
          <span className="label w-8 shrink-0">{line.house}</span>
          <span className="text-title text-muted w-16 shrink-0 tracking-normal tabular-nums">
            {line.score}
          </span>
          <span className="label ml-auto shrink-0 text-right">
            {line.note}
            {line.mine ? (line.note ? " · you" : "you") : ""}
          </span>
        </div>
        {line.hasBoard && line.target > 0 ? (
          <div className="bg-paper mt-2.5 flex h-2 w-full gap-[2px] overflow-hidden rounded-full">
            {segments
              .filter((s) => s.value > 0)
              .map((s) => (
                <div
                  key={s.label}
                  // Proportional flex so the parts always sum to the track and
                  // never clip, with a 3px floor so a count of one still shows.
                  className="h-full min-w-[3px]"
                  style={{
                    flex: `${s.value} 1 0%`,
                    background: s.fill,
                    opacity: s.opacity,
                  }}
                  title={`${s.label}: ${s.value}`}
                />
              ))}
          </div>
        ) : null}
      </Link>
    </li>
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
  deadlinePassed = false,
  deadlineLabel,
}: {
  rows: VenueWeekSummary[];
  hrefPrefix: string;
  ownVenueId?: string | null;
  /**
   * Four on Thursday has gone. A half short of ten is a fail from that
   * moment, without anybody grading it: the week cannot be completed any
   * more, and whatever is filed from now on counts toward the next one.
   * Before the deadline the same half is still to grade, because it can
   * still be finished.
   */
  deadlinePassed?: boolean;
  /** When the week is due, spelled out — for the filing view's copy. */
  deadlineLabel?: string;
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
    // Short of ten when the deadline went. Nothing anyone grades can change
    // that, so it is a fail now, not a thing waiting on a verdict.
    const missed = (house: HouseWeek) =>
      deadlinePassed &&
      (!house.hasBoard || house.doneCount < house.activeCount);

    const fullFail =
      row.scored.length > 0 &&
      row.scored.every(
        (house) =>
          missed(house) ||
          (Boolean(gradedBy(row.venue.id, house.house)) &&
            tierFor(house) === "fail"),
      );

    return row.scored.map((house) => {
      const graded = Boolean(gradedBy(row.venue.id, house.house));
      const ruled = house.hasBoard && house.scored && house.pendingCount === 0;
      // A board short of its ten when the deadline went has auto-failed on the
      // count (this is exactly what `missed` tests): its filed cards can never
      // add up to a pass, so they are not in anyone's queue and nobody is going
      // to grade them. The note still says it missed and how many came in, but
      // drops "to review" and "not graded" — those name pending grading work
      // that no longer exists. A board that filed its full ten is genuinely
      // awaiting a verdict and keeps both.
      const autoFailed = missed(house);
      const gradeNote = [
        autoFailed ? "missed 4pm" : null,
        !house.hasBoard ? "no board" : null,
        !autoFailed && house.pendingCount > 0
          ? `${house.pendingCount} to review`
          : null,
        house.rollingCount > 0 ? `${house.rollingCount} needs more time` : null,
        !autoFailed && house.hasBoard && !graded ? "not graded" : null,
        house.hasBoard && house.doneCount === 0
          ? "nothing filed"
          : house.hasBoard && house.doneCount < house.activeCount
            ? `${house.doneCount} filed`
            : null,
        house.redoCount > 0 ? `${house.redoCount} sent back` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      // Before the deadline nothing is graded, so the note is about filing
      // only — no "to review", no "not graded", none of the words that name a
      // verdict that cannot exist yet.
      const filingNote = [
        !house.hasBoard ? "no board yet" : null,
        house.hasBoard && house.doneCount === 0
          ? "nothing filed"
          : house.hasBoard && house.doneCount < house.activeCount
            ? `${house.doneCount} of ${house.activeCount} filed`
            : house.hasBoard
              ? "all in"
              : null,
        house.redoCount > 0 ? `${house.redoCount} sent back` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        venueId: row.venue.id,
        code: row.venue.code,
        house: house.house,
        filed: house.doneCount,
        target: house.activeCount,
        hasBoard: house.hasBoard,
        sentBack: house.redoCount,
        score: !deadlinePassed
          ? house.hasBoard
            ? `${house.doneCount}/${house.activeCount}`
            : "—"
          : house.hasBoard && house.scored
            ? `${house.approvedCount}/${house.activeCount}`
            : "—",
        // No verdict before the deadline, whatever an early grade row says.
        tier: !deadlinePassed
          ? null
          : missed(house)
            ? "fail"
            : graded
              ? tierFor(house)
              : null,
        ratio:
          ruled && house.activeCount > 0
            ? house.approvedCount / house.activeCount
            : 0,
        note: !deadlinePassed
          ? filingNote
          : fullFail
            ? [gradeNote, "whole venue"].filter(Boolean).join(" · ")
            : gradeNote,
        worst: fullFail || !house.hasBoard || house.doneCount === 0,
        mine: row.venue.id === ownVenueId,
      };
    });
  });

  // Before the deadline the week is filing, not grading. One list of who has
  // filed, least first, with not a word about grades or fails on a day nothing
  // is due. The grade view below returns the moment the deadline passes.
  if (!deadlinePassed) {
    const progress = (l: Line) =>
      l.hasBoard ? (l.target > 0 ? l.filed / l.target : 0) : -1;
    const byLeastFiled = (a: Line, b: Line) =>
      progress(a) - progress(b) || a.code.localeCompare(b.code);
    const started = lines.filter((l) => l.hasBoard && l.filed > 0).length;
    return (
      <Card
        className="col-span-12"
        title="This week"
        hint={`${rows.length} venues · filing is open · scores post after ${
          deadlineLabel ?? "the deadline"
        }`}
      >
        <p className="text-metric leading-[1.15]">
          {started} of {lines.length} boards started
        </p>
        <p className="label mt-2">
          Nothing is scored until the deadline. This is who has filed.
        </p>

        {/* Split by house, the way the grade view is, and each board drawn as
            a bar so the room reads at a glance rather than a column of "0/10". */}
        {HOUSES.map((house) => {
          const group = lines
            .filter((line) => line.house === house)
            .sort(byLeastFiled);
          if (group.length === 0) return null;
          return (
            <div key={house} className="mt-6">
              <p className="label border-divider border-t pt-4">
                {houseName(house)} · {group.length}
              </p>
              <ul className="-mx-3 mt-2 space-y-[2px]">
                {group.map((line) => (
                  <FilingRow
                    key={`${line.venueId}-${line.house}`}
                    line={line}
                    href={`${hrefPrefix}${line.venueId}`}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </Card>
    );
  }

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
        `${rows.length} venues · ${lines.length} house boards`,
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

      {/* Two people grade, one half each. One pile had the dining room
          grader ruling on kitchens and the other way round, so the queue is
          split by half before anything else. */}
      {HOUSES.map((house) => (
        <Tier
          key={house}
          title={`Still to grade · ${houseName(house)}`}
          lines={waiting.filter((line) => line.house === house)}
          hrefPrefix={hrefPrefix}
        />
      ))}
      <Tier title="Fail" lines={fails} hrefPrefix={hrefPrefix} />
      <Tier title="Neutral" lines={neutrals} hrefPrefix={hrefPrefix} />
      <Tier title="Good" lines={goods} hrefPrefix={hrefPrefix} />
    </Card>
  );
}
