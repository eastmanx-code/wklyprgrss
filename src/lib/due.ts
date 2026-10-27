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
 *
 * A caller may also hand dueOnNight an explicit list of weekdays instead of
 * leaning on the heading, for a list or an item that runs only on named
 * nights. That list wins over any heading when it is given.
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
 * Is an item due on this night?
 *
 * Two ways an item can be tied to particular nights, checked in order:
 *
 * 1. An explicit `days` list handed in by the caller. It names every weekday
 *    the item is owed and can name more than one, for a list or item that runs
 *    only on certain nights. A heading on the item is ignored while the list is
 *    present; the list is the schedule. Each entry reads the same forgiving way
 *    as a heading, so FRIDAY, Friday and "friday" all land, and an entry that
 *    is not a weekday matches nothing.
 * 2. The item's heading. A weekday, several weekdays, or weekdays pinned to
 *    weeks of the month, parsed above.
 *
 * True for everything with neither, which is almost everything. An unreadable
 * night is treated as "due", because a list that shows too much is recoverable
 * and a list that quietly hides tonight's job is not.
 */
export function dueOnNight(
  section: string | null | undefined,
  night: string,
  days?: readonly (string | null | undefined)[] | null,
): boolean {
  const tonight = weekdayOfNight(night);
  if (days && days.length > 0) {
    if (tonight === null) return true;
    return days.some((d) => dayOfSection(d) === tonight);
  }
  const schedule = parseSchedule(section);
  if (!schedule) return true;
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

// ------------------------------------------------------------ weekly cadence

/**
 * A cadence heading says how often, not which night. WEEKLY and MONTHLY are
 * owed once in their period, on whatever night the crew gets to them, and clear
 * for the rest of the period once done. That is different from a weekday
 * heading, which pins the work to a fixed night, and different from a plain
 * grouping, which is owed every night.
 *
 * Before this existed the headings parsed as groupings, so a once-a-week bar
 * cleaning showed as owed and open every single night and nobody could ever
 * sign a clean list. Strict like parseSchedule: every word must be the cadence
 * word or a connector, so "WEEKLY DEEP CLEAN" keeps its stray words and stays
 * an ordinary grouping, and only a bare WEEKLY or MONTHLY is a cadence.
 */
export type Cadence = "weekly" | "monthly";

const CADENCE_WORDS: Record<string, Cadence> = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};

export function cadenceOf(section: string | null | undefined): Cadence | null {
  if (!section) return null;
  const words = wordsOf(section);
  if (words.length === 0) return null;
  let found: Cadence | null = null;
  for (const w of words) {
    if (w in CADENCE_WORDS) {
      // Two different cadence words in one heading name no single period.
      if (found && found !== CADENCE_WORDS[w]) return null;
      found = CADENCE_WORDS[w];
    } else if (FILLER.has(w)) {
      // a connector, carries no meaning of its own
    } else {
      // a word that is neither: this heading groups work, it does not pace it.
      return null;
    }
  }
  return found;
}

/** A night's date shifted by whole days, noon-UTC so no offset moves the date. */
function addDays(night: string, days: number): string {
  const at = new Date(`${night}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * The first night of the period a night sits in: the Monday on or before it for
 * a weekly cadence, the first of the month for a monthly one. Null when the
 * night is unreadable. The week is Monday-anchored, the same week the walkthrough
 * board already counts in.
 */
export function periodStartOf(
  cadence: Cadence,
  night: string,
): string | null {
  if (cadence === "monthly") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
    return `${night.slice(0, 7)}-01`;
  }
  const dow = weekdayOfNight(night);
  if (dow === null) return null;
  // getUTCDay is Sun..Sat = 0..6; shift so Monday is 0.
  return addDays(night, -((dow + 6) % 7));
}

/** The last night of the period a night sits in: its Sunday, or month end. */
function periodEndNight(cadence: Cadence, night: string): string | null {
  if (cadence === "weekly") {
    const start = periodStartOf("weekly", night);
    return start === null ? null : addDays(start, 6);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  const at = new Date(`${night}T12:00:00Z`);
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
}

/**
 * The item shape the cadence resolvers read: an id to look work up by, plus the
 * heading and day list every other due check already takes.
 */
export type CadenceItem = {
  id: string;
  section?: string | null;
  days?: string[] | null;
};

/**
 * What a cadence resolver needs, as plain data so it can be built from the same
 * rows a report already loaded and tested with no database.
 *
 * - `cadenceByItem` names only the cadence items; everything else falls through
 *   to the ordinary weekday rules.
 * - `tickNightsByItem` is every night an item was ticked, so "done this period"
 *   is a lookup rather than a second pass.
 * - `runningNightsByItem` is the item's venue's running nights, so an undone
 *   period can be pinned to the last night the building was actually open.
 * - `today` is the current night; a period is only scored once it has closed,
 *   so an item still has the rest of this week to be done before it counts.
 */
export type CadenceContext = {
  cadenceByItem: Map<string, Cadence>;
  tickNightsByItem: Map<string, string[]>;
  runningNightsByItem: Map<string, string[]>;
  today: string;
};

/**
 * Whether a cadence item is OWED TONIGHT, for the crew list and the signature.
 *
 * A cadence item is owed every night of its period until it is done once, then
 * it clears. `satisfiedEarlier` is whether it was already ticked on an earlier
 * night of this same period; tonight's own tick does not count, so a box ticked
 * tonight still shows, done. A non-cadence item answers the ordinary way.
 */
export function cadenceOwedTonight(
  section: string | null | undefined,
  night: string,
  days: readonly (string | null | undefined)[] | null | undefined,
  satisfiedEarlier: boolean,
): boolean {
  if (cadenceOf(section) === null) return dueOnNight(section, night, days);
  return !satisfiedEarlier;
}

/**
 * The due rule a report scores with, cadence-aware.
 *
 * A cadence item is owed once per period, so it is "due" on exactly one night
 * of the period: the night it was first done, or — once the period has closed
 * with nothing done — the last night the building was open. On every other
 * night it is not due, which is what stops a once-a-week job reading as six
 * misses. A period still open and not yet done is due on no night at all, so it
 * counts as neither done nor missed until the week is actually over. Non-cadence
 * items keep the ordinary weekday behaviour exactly.
 *
 * Returned as the IsDue the rollup already injects, so the arithmetic in
 * rollup-math.ts does not change: it still scores whatever is due-and-ticked,
 * and this just narrows what "due" means for the cadence rows.
 */
export function makeCadenceDue(
  ctx: CadenceContext,
): (item: CadenceItem, night: string) => boolean {
  return (item, night) => {
    const cadence = ctx.cadenceByItem.get(item.id);
    if (!cadence) return dueOnNight(item.section, night, item.days);
    const start = periodStartOf(cadence, night);
    if (start === null) return dueOnNight(item.section, night, item.days);
    const samePeriod = (n: string) => periodStartOf(cadence, n) === start;

    const ticks = (ctx.tickNightsByItem.get(item.id) ?? []).filter(samePeriod);
    // Done this period: scored on the earliest night it was ticked, where the
    // tick makes the list complete. Ticks arrive oldest first.
    if (ticks.length > 0) return night === ticks[0];

    // Not done. Only once the period is over does an empty one become a miss,
    // and it lands on the last night the venue was open in that period.
    const end = periodEndNight(cadence, night);
    if (end === null || end >= ctx.today) return false;
    const running = (ctx.runningNightsByItem.get(item.id) ?? []).filter(
      samePeriod,
    );
    if (running.length === 0) return false;
    return night === running[running.length - 1];
  };
}
