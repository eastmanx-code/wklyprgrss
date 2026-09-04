import Link from "next/link";

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
}: {
  name: string;
  state: "pass" | "fail" | "open" | "empty";
  reason: string;
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
export function NightNav({ night, base }: { night: string; base: string }) {
  const today = currentNight();
  const prev = shiftNights(night, -1);
  const next = shiftNights(night, 1);
  const canGoForward = next <= today;

  return (
    <nav className="flex items-center justify-between gap-3">
      <Link
        href={`${base}?night=${prev}`}
        className="ring-card-border text-ink inline-flex min-h-11 items-center rounded px-4 text-label tracking-[0.08em] ring-1"
      >
        ← {formatNight(prev)}
      </Link>
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
