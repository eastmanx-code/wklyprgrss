import "server-only";

import { DEADLINE_DAY, DEADLINE_HOUR } from "./env";

export const TZ = "America/Los_Angeles";

const DAY_MS = 86_400_000;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsInTz(date: Date): Parts {
  const out: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return out as unknown as Parts;
}

/** Offset of the zone from UTC at this instant, in ms (negative for Pacific). */
function tzOffsetMs(date: Date): number {
  const p = partsInTz(date);
  const asIfUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Convert a Pacific wall-clock time to the real UTC instant. Two passes so the
 * offset is sampled at the answer rather than at the naive guess, which is what
 * makes DST-transition weeks land correctly.
 */
function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  let ts = naive - tzOffsetMs(new Date(naive));
  ts = naive - tzOffsetMs(new Date(ts));
  return new Date(ts);
}

function toIsoDate(utcMidnight: number): string {
  const d = new Date(utcMidnight);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoDateToUtcMidnight(weekStart: string): number {
  const [y, m, d] = weekStart.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * The Monday (Pacific) of the week containing `now`, as a YYYY-MM-DD string.
 * This is the value stored in submissions.week_start.
 */
export function currentWeekStart(now: Date = new Date()): string {
  const p = partsInTz(now);
  const dateOnly = Date.UTC(p.year, p.month - 1, p.day);
  const dow = new Date(dateOnly).getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dow + 6) % 7;
  return toIsoDate(dateOnly - daysSinceMonday * DAY_MS);
}

export function shiftWeeks(weekStart: string, weeks: number): string {
  return toIsoDate(isoDateToUtcMidnight(weekStart) + weeks * 7 * DAY_MS);
}

/**
 * The calendar day an instant fell on, in the venues' own timezone.
 *
 * A submission filed at 8pm Pacific on Wednesday is stored as Thursday in UTC.
 * Counting days off the raw timestamp would move a third of a normal evening's
 * work into the next day, and on the deadline day it would move it past the
 * deadline.
 */
export function dayInTz(iso: string): string {
  const p = partsInTz(new Date(iso));
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Today, where the venues are. */
export function todayInTz(now: Date = new Date()): string {
  return dayInTz(now.toISOString());
}

/** The seven calendar days of a week, Monday first. */
export function daysOfWeek(weekStart: string): string[] {
  const base = isoDateToUtcMidnight(weekStart);
  return Array.from({ length: 7 }, (_, i) => toIsoDate(base + i * DAY_MS));
}

/**
 * The Sunday that closes a week, for the warehouse.
 *
 * This app keys a week on the Monday it opens; the CH warehouse keys every
 * weekly table on the Sunday it ends. Two right answers to the same question,
 * and a join between them silently matches nothing — so the export carries
 * both and the warehouse joins on the one it already uses.
 */
export function weekEnding(weekStart: string): string {
  return toIsoDate(isoDateToUtcMidnight(weekStart) + 6 * DAY_MS);
}

/**
 * Whole weeks between two week starts. Both are Mondays, so this is exact
 * division rather than a rounding question — and it stays right across a DST
 * boundary because week starts are dates, not instants.
 */
export function weeksBetween(from: string, to: string): number {
  return Math.round(
    (isoDateToUtcMidnight(to) - isoDateToUtcMidnight(from)) / (7 * DAY_MS),
  );
}

/**
 * The deadline instant for a given week. DEADLINE_DAY is 0=Sun..6=Sat Pacific,
 * resolved inside the Monday-anchored week (so Sunday is the last day, not the
 * first).
 */
export function deadlineFor(weekStart: string): Date {
  const daysFromMonday = (DEADLINE_DAY() + 6) % 7;
  const target = new Date(
    isoDateToUtcMidnight(weekStart) + daysFromMonday * DAY_MS,
  );
  return zonedToUtc(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    target.getUTCDate(),
    DEADLINE_HOUR(),
  );
}

/**
 * How long a week's working window really is: Monday 00:00 Pacific to the
 * deadline. Shorter than seven days — anything drawing time left as a
 * proportion needs this, not DAY_MS * 7, or the gauge starts part-empty on
 * Monday morning and can never fill.
 */
export function weekWindowMs(weekStart: string): number {
  const [year, month, day] = weekStart.split("-").map(Number);
  return (
    deadlineFor(weekStart).getTime() - zonedToUtc(year, month, day).getTime()
  );
}

export function isDeadlinePassed(
  weekStart: string,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= deadlineFor(weekStart).getTime();
}

/**
 * The most recent week whose deadline has already passed — the newest week that
 * can be judged PASS or FAIL. Fail streaks count back from here.
 */
export function mostRecentCompletedWeek(now: Date = new Date()): string {
  const current = currentWeekStart(now);
  return isDeadlinePassed(current, now) ? current : shiftWeeks(current, -1);
}

const deadlineLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "long",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDeadline(weekStart: string): string {
  return `${deadlineLabelFormatter.format(deadlineFor(weekStart))} PT`;
}

const weekLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

/** "Mar 3" — the Monday the week started. */
export function formatWeekStart(weekStart: string): string {
  return weekLabelFormatter.format(new Date(isoDateToUtcMidnight(weekStart)));
}

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Wed 2:14 PM" — when a venue finished, in the timezone the deadline uses. */
export function formatFinish(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTimestamp(iso: string): string {
  return `${timestampFormatter.format(new Date(iso))} PT`;
}

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  month: "short",
  day: "numeric",
});

/**
 * "Jul 24 · 6d" — when the last photo landed, and how stale that is. The age
 * is what makes a neglected item obvious at a glance.
 */
export function formatLastUpload(iso: string, now: Date = new Date()): string {
  const uploaded = new Date(iso);
  const days = Math.max(
    0,
    Math.floor((now.getTime() - uploaded.getTime()) / DAY_MS),
  );
  const date = shortDateFormatter.format(uploaded);
  if (days === 0) return `${date} · today`;
  if (days === 1) return `${date} · 1d`;
  return `${date} · ${days}d`;
}
