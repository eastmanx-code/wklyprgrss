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
