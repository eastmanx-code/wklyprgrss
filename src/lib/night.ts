/**
 * Which night a moment belongs to.
 *
 * A close does not respect midnight. The MOD who signs off at 1:30am Saturday
 * is finishing Friday's shift, and filing that under Saturday would show
 * Friday as never certified and Saturday as certified twice. So the night is
 * the unit, and it runs until 4am Pacific.
 *
 * Deliberately free of imports — no `server-only`, no env — so the same
 * function decides the night on the server and renders it in the browser, and
 * so it can be tested on its own. It duplicates a little of week.ts's timezone
 * handling for that independence; if a third caller ever needs it, that is the
 * moment to extract a shared module rather than now.
 */

export const TZ = "America/Los_Angeles";

/**
 * The hour a night ends, Pacific. Everything before it belongs to the day
 * before. A house rule rather than a per-venue setting — a group whose venues
 * closed at different hours would each report a different day for the same
 * shift, which is the confusion this exists to remove.
 */
export const NIGHT_ENDS_HOUR = 4;

const DAY_MS = 86_400_000;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
});

function pacificParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  const out: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return out as { year: number; month: number; day: number; hour: number };
}

function toIsoDate(utcMidnight: number): string {
  const d = new Date(utcMidnight);
  return [
    String(d.getUTCFullYear()).padStart(4, "0"),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * The night `now` falls in, as YYYY-MM-DD — the date the shift *started*.
 *
 * Calendar arithmetic on Pacific date parts rather than subtracting four hours
 * from a timestamp, which is what keeps the two clock-change nights right. On
 * the spring-forward night 2am–3am never happens and on the fall-back night
 * 1am–2am happens twice; in both cases the local hour is still under four, so
 * both still belong to the evening before, and neither needs a special case.
 */
export function currentNight(now: Date = new Date()): string {
  const { year, month, day, hour } = pacificParts(now);
  const dateOnly = Date.UTC(year, month - 1, day);
  return toIsoDate(hour < NIGHT_ENDS_HOUR ? dateOnly - DAY_MS : dateOnly);
}

/**
 * How long after the changeover a shift can still be finishing.
 *
 * The night is a pure function of the clock, so at 4am the answer changes and
 * every screen rendered after it asks about a different night. That is right
 * for a report and wrong for a crew: a close still being walked at 4:05 had
 * its board empty itself in front of them and its remaining ticks filed under
 * the next night, splitting one shift's record in two.
 *
 * Three hours is the outer bound on "still finishing". It is not the test on
 * its own — activity is — but it stops a night that was reopened at nine in
 * the evening from being mistaken for one somebody is standing in.
 */
export const CARRY_HOURS = 3;

/**
 * How recently a list must have been touched to count as still being walked.
 *
 * This is the real test, and it is what separates a close running past four
 * from a prep open starting at six. Yesterday's prep was last touched
 * twenty-four hours ago; a close in progress was touched minutes ago.
 *
 * Ninety minutes rather than something tighter because a cellar or a walk-in
 * is a long job with no taps in it, and rolling somebody onto a new night
 * mid-shift is the failure this exists to prevent.
 */
export const CARRY_MINUTES = 90;

/** The hours after the changeover when a shift may still be running. */
export function inCarryWindow(now: Date = new Date()): boolean {
  const { hour } = pacificParts(now);
  return hour >= NIGHT_ENDS_HOUR && hour < NIGHT_ENDS_HOUR + CARRY_HOURS;
}

/**
 * Is the night before this one still live?
 *
 * `lastActivity` is the most recent thing that happened on it: a tick, or the
 * signature. The signature counts because signing is not the end of somebody's
 * involvement — a MOD who signs at 3:55 and spots a mistake at 4:05 has to be
 * able to reopen the night they just signed, not the empty one that replaced
 * it.
 *
 * A time in the future is not activity. A phone clock can be wrong and a
 * server clock can skew, and neither is a reason to hand a crew the wrong
 * night.
 */
export function carriesForward(
  lastActivity: string | null,
  now: Date = new Date(),
): boolean {
  if (!inCarryWindow(now)) return false;
  if (!lastActivity) return false;
  const at = Date.parse(lastActivity);
  if (Number.isNaN(at)) return false;
  const minutes = (now.getTime() - at) / 60_000;
  return minutes >= 0 && minutes <= CARRY_MINUTES;
}

/** Shift a night by whole days. */
export function shiftNights(night: string, days: number): string {
  const [y, m, d] = night.split("-").map(Number);
  return toIsoDate(Date.UTC(y, m - 1, d) + days * DAY_MS);
}

/**
 * The instant a night stops accepting work: 4am Pacific on the following
 * calendar day. Sampled twice so the offset is read at the answer rather than
 * at the guess, which is what makes the clock-change nights land correctly.
 */
export function nightEndsAt(night: string): Date {
  const [y, m, d] = night.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d) + DAY_MS);
  const naive = Date.UTC(
    next.getUTCFullYear(),
    next.getUTCMonth(),
    next.getUTCDate(),
    NIGHT_ENDS_HOUR,
  );
  const offsetAt = (instant: number) => {
    const p = pacificParts(new Date(instant));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour) - instant;
  };
  let ts = naive - offsetAt(naive);
  ts = naive - offsetAt(ts);
  return new Date(ts);
}

export function isNightOver(night: string, now: Date = new Date()): boolean {
  return now.getTime() >= nightEndsAt(night).getTime();
}

const nightLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** "Fri Aug 1" — the evening the shift began, which is how people name it. */
export function formatNight(night: string): string {
  const [y, m, d] = night.split("-").map(Number);
  return nightLabelFormatter.format(new Date(Date.UTC(y, m - 1, d)));
}

const nightLabelFormatterEs = new Intl.DateTimeFormat("es-MX", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

/**
 * The same date, read by somebody who reads Spanish.
 *
 * A date is the first thing on every one of these screens and it was the last
 * thing still in English on a page that had otherwise flipped, which reads as
 * the translation having given up half way rather than as a date.
 */
export function formatNightEs(night: string): string {
  const [y, m, d] = night.split("-").map(Number);
  return nightLabelFormatterEs.format(new Date(Date.UTC(y, m - 1, d)));
}

const clockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
});

/**
 * "11:52 PM", in the venue's own time.
 *
 * Stamps are stored in UTC, and a close signed at 11:52 Pacific is stored as
 * the following morning. Rendered raw it reads as 6:52am, which on a close
 * report is not a rounding error but a different night.
 */
export function formatClock(iso: string): string {
  return clockFormatter.format(new Date(iso));
}
