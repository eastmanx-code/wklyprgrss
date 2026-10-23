/**
 * Which items are actually due tonight.
 *
 * Import-free on purpose, like the night maths, so scripts/check-due.mjs can
 * prove it without a database.
 *
 * A deep clean list is seven items and one of them is yours. The heading over
 * each one is a day: MONDAY dusts a third of the retail shelves, SUNDAY pours
 * water down the hood drains. Doing your day is the whole job.
 *
 * The app counted all seven every night. So a bartender who did exactly what
 * was asked saw 0 of 7 and a button offering to sign with seven not done. The
 * app called a finished job a failure, every night, on both deep clean lists,
 * and then nobody touched them, which is the correct response to a scoreboard
 * that cannot be satisfied.
 *
 * The rule is deliberately narrow: a heading is a schedule only when every
 * word in it is a weekday, an ordinal, or a connector. One stray word and it
 * is a grouping again. CLOSING SQUAD, FIRST CUTS and DAILY are groupings, not
 * schedules, and an item under one of those is due whenever its list is
 * walked. An item with no heading is due too, which is what keeps every
 * ordinary list behaving exactly as before.
 *
 * Three shapes of schedule are understood, all off the same paper the crews
 * used:
 *   MONDAY                      every Monday
 *   TUESDAY AND FRIDAY AND SAT  every Tuesday, Friday and Saturday
 *   FIRST AND THIRD MONDAYS     the first and third Monday of the month
 *   LAST FRIDAY                 the last Friday of the month
 * A heading may name more than one weekday and may pin them to weeks of the
 * month. With no ordinal it is every one of those weekdays; with an ordinal it
 * is only those occurrences.
 */

/** Weekday words, long and short, singular and plural, to a day index. */
const DAY_WORDS: Record<string, number> = {
  SUN: 0, SUNDAY: 0, SUNDAYS: 0,
  MON: 1, MONDAY: 1, MONDAYS: 1,
  TUE: 2, TUES: 2, TUESDAY: 2, TUESDAYS: 2,
  WED: 3, WEDS: 3, WEDNESDAY: 3, WEDNESDAYS: 3,
  THU: 4, THUR: 4, THURS: 4, THURSDAY: 4, THURSDAYS: 4,
  FRI: 5, FRIDAY: 5, FRIDAYS: 5,
  SAT: 6, SATURDAY: 6, SATURDAYS: 6,
};

/** Ordinal words for weeks of the month. "last" is the final occurrence. */
const ORDINAL_WORDS: Record<string, number | "last"> = {
  FIRST: 1, "1ST": 1, "1": 1,
  SECOND: 2, "2ND": 2, "2": 2,
  THIRD: 3, "3RD": 3, "3": 3,
  FOURTH: 4, "4TH": 4, "4": 4,
  FIFTH: 5, "5TH": 5, "5": 5,
  LAST: "last",
};

/**
 * Words allowed inside a schedule that neither name a day nor an ordinal.
 * Anything outside this, a day word or an ordinal word means the heading is a
 * grouping, not a schedule, and the item is due whenever its list is walked.
 */
const FILLER = new Set(["AND", "OF", "THE", "MONTH", "MONTHS", "EVERY", "EACH"]);

type Schedule = { days: Set<number>; ordinals: Set<number | "last"> };

/** The words of a heading, uppercased, punctuation dropped. */
function wordsOf(section: string): string[] {
  return section
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

/**
 * The schedule a heading describes, or null when it does not describe one.
 *
 * Strict on purpose. Every word has to be a weekday, an ordinal or a
 * connector, and at least one weekday has to be named. "MONDAY PREP" keeps its
 * stray word and stays a grouping; "FIRST AND THIRD MONDAYS" does not.
 */
function parseSchedule(section: string | null | undefined): Schedule | null {
  if (!section) return null;
  const words = wordsOf(section);
  if (words.length === 0) return null;
  const days = new Set<number>();
  const ordinals = new Set<number | "last">();
  for (const w of words) {
    if (w in DAY_WORDS) {
      days.add(DAY_WORDS[w]);
    } else if (w in ORDINAL_WORDS) {
      ordinals.add(ORDINAL_WORDS[w]);
    } else if (FILLER.has(w)) {
      // allowed, carries no meaning of its own
    } else {
      // a word that schedules nothing: this heading groups work, it does not
      // time it.
      return null;
    }
  }
  if (days.size === 0) return null;
  return { days, ordinals };
}

/**
 * The day a heading names, or null when it does not name exactly one.
 *
 * Kept single-weekday only because its one caller, the initials carry on a
 * close list, groups consecutive rows that share a day. A multi-day or
 * monthly heading is its own row and does not carry, which is the safe
 * default. Reads the same as it always did for a plain "MONDAY".
 */
export function dayOfSection(section: string | null | undefined): number | null {
  const schedule = parseSchedule(section);
  if (!schedule) return null;
  if (schedule.ordinals.size > 0) return null;
  if (schedule.days.size !== 1) return null;
  return [...schedule.days][0];
}

/**
 * The weekday a night falls on.
 *
 * The night, not the clock. A shift working at one in the morning on Tuesday
 * is still on Monday night and still owes Monday's deep clean; asking the
 * device what day it is would hand them Tuesday's and mark Monday missed.
 * currentNight already carries that rule, so this only has to read it.
 *
 * Noon UTC rather than midnight, so no offset can push the date onto the day
 * either side of the one that was meant.
 */
export function weekdayOfNight(night: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  const at = new Date(`${night}T12:00:00Z`);
  const day = at.getUTCDay();
  return Number.isNaN(day) ? null : day;
}

/**
 * Which occurrence of its weekday a night is within its month, and whether it
 * is the last one. The first Monday of the month is nth 1; a fifth Friday,
 * where the month has one, is both nth 5 and the last.
 */
function occurrenceInMonth(night: string): { nth: number; isLast: boolean } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  const at = new Date(`${night}T12:00:00Z`);
  const dom = at.getUTCDate();
  if (Number.isNaN(dom)) return null;
  const nth = Math.floor((dom - 1) / 7) + 1;
  const daysInMonth = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return { nth, isLast: dom + 7 > daysInMonth };
}

/**
 * Is an item with this heading due on this night?
 *
 * True for everything that is not a schedule, which is almost everything. A
 * scheduled item is due only on a weekday it names, and when the heading pins
 * weeks of the month, only on those occurrences. An unreadable night is
 * treated as "due", because a list that shows too much is recoverable and a
 * list that quietly hides tonight's job is not.
 */
export function dueOnNight(
  section: string | null | undefined,
  night: string,
): boolean {
  const schedule = parseSchedule(section);
  if (!schedule) return true;
  const tonight = weekdayOfNight(night);
  if (tonight === null) return true;
  if (!schedule.days.has(tonight)) return false;
  if (schedule.ordinals.size === 0) return true;
  const occ = occurrenceInMonth(night);
  if (occ === null) return true;
  return (
    schedule.ordinals.has(occ.nth) ||
    (schedule.ordinals.has("last") && occ.isLast)
  );
}

/**
 * Does this list schedule its items across the week or the month?
 *
 * Used to decide whether a screen should explain itself. A list where nothing
 * is scheduled should look exactly as it always has.
 */
export function hasDayScheduling(
  sections: (string | null | undefined)[],
): boolean {
  return sections.some((section) => parseSchedule(section) !== null);
}
