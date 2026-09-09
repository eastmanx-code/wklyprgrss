import Link from "next/link";

import type { ListVerdict } from "@/lib/compliance";
import { shiftNights, currentNight, formatNight } from "@/lib/night";

/**
 * The shared furniture of the three compliance screens.
 *
 * One score bar and one verdict row, used at every level, so a venue on the
 * group screen and a list on the venue screen are visibly the same kind of
 * object read at two depths.
 */

/**
 * A venue's night, as a bar.
 *
 * The weekly board's proportions exactly: code and score in fixed columns so
 * the numbers line up down the left however long the trailer is, one height
 * whatever it scored, and the whole bar lime on a fail rather than a coloured
 * dot at the end of it. Somebody who reads the weekly board already knows how
 * to read this one.
 */
export function ScoreBar({
  score,
  code,
  tier,
  note,
}: {
  score: number;
  code: string;
  tier: "good" | "neutral" | "fail";
  note: string;
}) {
  const failed = tier === "fail";
  return (
    <div
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
        {code}
      </span>
      <span
        className={`text-title w-16 shrink-0 tracking-normal tabular-nums ${
          failed
            ? "text-on-warn"
            : tier === "neutral"
              ? "text-warn"
              : "text-ink"
        }`}
      >
        {score}/10
      </span>
      <span
        className={`label ml-auto shrink-0 text-right ${
          failed ? "text-on-warn" : ""
        }`}
      >
        {note}
      </span>
    </div>
  );
}

/**
 * One list's verdict, with the reason on it.
 *
 * "Fail" on its own sends a manager hunting through five lists to find out
 * which and why. The reason is the row's whole value, so it is printed rather
 * than hidden behind the tap.
 */
export function VerdictRow({
  name,
  state,
  reason,
  flag,
}: {
  name: string;
  state: "pass" | "fail" | "open" | "empty";
  reason: string;
  /**
   * The pace, when the ticks came too fast to have been a walk.
   *
   * Sits under the verdict rather than replacing it, because the two say
   * different things: the verdict is what the rows add up to, this is how
   * they arrived. A list can be a clean pass on the first and worthless on
   * the second, and that combination is the whole reason to look.
   */
  flag?: string | null;
}) {
  const failed = state === "fail";
  const word =
    state === "fail"
      ? "Fail"
      : state === "pass"
        ? "Pass"
        : state === "open"
          ? "Open"
          : "Not written";

  return (
    <div
      className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-[4px] px-4 py-3 ${
        failed
          ? "bg-warn text-on-warn hover:bg-warn/90"
          : "bg-inset hover:ring-muted/30 hover:ring-1 hover:ring-inset"
      }`}
    >
      <span className="text-body">{name}</span>
      <span className="text-label font-medium tracking-[0.08em]">{word}</span>
      <span
        className={`col-span-2 text-label tracking-[0.08em] ${
          failed ? "text-on-warn" : "text-muted"
        }`}
      >
        {reason}
      </span>
      {flag ? (
        <span
          className={`col-span-2 text-label tracking-[0.08em] ${
            failed ? "text-on-warn" : "text-warn"
          }`}
        >
          {flag}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Last night, tonight, next night.
 *
 * A manager reading this at ten in the morning wants the night that just
 * finished, not the one that started an hour ago, and typing a date into a
 * query string is not a control. Forward stops at tonight: there is nothing
 * to report on a night that has not happened.
 */
export function NightNav({
  night,
  base,
  children,
}: {
  night: string;
  base: string;
  /** Something for the middle of the row, so it is not an orphan below. */
  children?: React.ReactNode;
}) {
  const today = currentNight();
  const prev = shiftNights(night, -1);
  const next = shiftNights(night, 1);
  const canGoForward = next <= today;

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3">
      <Link
        href={`${base}?night=${prev}`}
        className="ring-card-border text-ink inline-flex min-h-11 items-center rounded px-4 text-label tracking-[0.08em] ring-1"
      >
        ← {formatNight(prev)}
      </Link>
      {children}
      {canGoForward ? (
        <Link
          href={`${base}?night=${next}`}
          className="ring-card-border text-ink inline-flex min-h-11 items-center rounded px-4 text-label tracking-[0.08em] ring-1"
        >
          {formatNight(next)} →
        </Link>
      ) : (
        <span className="label">Latest night</span>
      )}
    </nav>
  );
}

/**
 * The month, as a grid you can tap into.
 *
 * The arrows walked one night at a time, which is fine for "what happened
 * last night" and useless for "when did this start". Thirty squares say where
 * the bad nights are and every one of them is a link, so getting to the
 * Tuesday three weeks ago is one tap rather than twenty.
 *
 * Two buckets and no legend: quiet grey for a night where every list was
 * done and signed, yellow for a night where something was not. The same rule
 * as the rollup's strip. Twenty-four blocks shouting "fine" would drown the
 * six that are the point of the page, and three shades needed a key to read.
 */
export function NightStrip({
  nights,
  current,
  base,
}: {
  nights: { night: string; state: "complete" | "short" }[];
  current: string;
  base: string;
}) {
  if (nights.length === 0) return null;

  const fill = {
    complete: "bg-ink/20 hover:bg-ink/30",
    short: "bg-warn hover:bg-warn/80",
  } as const;

  return (
    <div>
      {/* Ten across on a phone, fifteen on a laptop, and never capped: capped
          at a phone's width it sat tucked in the corner of a screen three
          times wider. A tap target still has to survive a thumb at 2am. */}
      {/* A day number under each square. Without it the strip read as a
          row of venues to somebody seeing it cold, and a calendar that
          needs explaining is not a calendar. */}
      <div className="grid grid-cols-10 gap-1 lg:grid-cols-15">
        {nights.map((n) => (
          <Link
            key={n.night}
            href={`${base}?night=${n.night}`}
            aria-label={`${formatNight(n.night)} · ${
              n.state === "complete"
                ? "every list checked off and signed off"
                : "something not checked off or not signed off"
            }`}
            aria-current={n.night === current ? "date" : undefined}
            className="flex flex-col items-center gap-1"
          >
            <span
              className={`block aspect-square w-full rounded-[2px] ${fill[n.state]} ${
                n.night === current ? "ring-ink ring-2 ring-offset-0" : ""
              }`}
            />
            <span
              className={`label tabular-nums ${
                n.night === current ? "text-ink" : ""
              }`}
            >
              {Number(n.night.slice(8, 10))}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * One list as a bar, in the weekly board's proportions.
 *
 * The name on the left and what happened on the right, in one line; the two
 * facts underneath in small type, with the one that failed in weight. Yellow
 * only when it failed. The same bar at every level of the report, so a row
 * here and a row on the locations screen are visibly the same object.
 */
export function ListBar({
  list,
  code,
  night,
  full = false,
}: {
  list: ListVerdict;
  code: string;
  night: string;
  /**
   * Every item left, by its whole title. On the venue's own page a manager
   * is reading to act, and "the carts" is not enough to act on. Off on the
   * locations screen, where the bar is a summary and the first clause is.
   */
  full?: boolean;
}) {
  const failed = list.state === "fail";
  const open = list.row.open;
  const verdict =
    list.group === "unsigned"
      ? "not signed off"
      : list.group === "gaps"
        ? `${open} not checked off`
        : list.group === "going"
          ? "still going"
          : list.group === "empty"
            ? "nothing on it"
            : "checked off and signed off";
  // What is missing outranks who did the rest: the fail first and in
  // weight, then the record of who checked and who signed, muted.
  const missing = list.facts.filter((f) => f.warn);
  const record = list.facts.filter((f) => !f.warn);
  const line = (facts: typeof list.facts) =>
    facts.map((fact, i) => (
      <span key={fact.label}>
        {i > 0 ? " · " : ""}
        {fact.label} {fact.value}
      </span>
    ));
  const items = full && list.group === "gaps" ? list.row.open_titles : null;
  return (
    <li>
      <Link
        href={`/checklists/compliance/${code}/${list.row.checklist_id}?night=${night}`}
        className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 rounded-[4px] px-4 py-3 ${
          failed
            ? "bg-warn text-on-warn hover:bg-warn/90"
            : "bg-inset hover:ring-muted/30 hover:ring-1 hover:ring-inset"
        }`}
      >
        <span className="text-body font-medium">{list.name}</span>
        <span className="text-label font-medium tracking-[0.08em] whitespace-nowrap uppercase">
          {verdict}
        </span>
        {/* The missing items, one to a line, in full, where the page is
            for acting on them; the first clause where it is a summary. */}
        {items ? (
          <ul className="col-span-2 text-body font-medium">
            {items.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        ) : missing.length > 0 ? (
          <span className="col-span-2 text-body font-medium">
            {line(missing)}
          </span>
        ) : null}
        {record.length > 0 ? (
          <span
            className={`col-span-2 text-body ${
              failed ? "text-on-warn/75" : "text-muted"
            }`}
          >
            {line(record)}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
