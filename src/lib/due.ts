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
 * The rule is deliberately narrow: a heading that names a weekday means that
 * item belongs to that day. Every other heading is a heading. CLOSING SQUAD,
 * FIRST CUTS and DAILY are groupings, not schedules, and an item under one of
 * those is due whenever its list is walked. An item with no heading is due
 * too, which is what keeps every ordinary list behaving exactly as before.
 */

/** Index matches Date.getUTCDay: Sunday is 0. */
const DAYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

/**
 * The day a heading names, or null when it does not name one.
 *
 * Forgiving about case and stray punctuation because a heading is typed by
 * whoever writes the list, and "Monday" and "MONDAY:" mean the same thing to
 * the person reading it off the wall.
 */
export function dayOfSection(section: string | null | undefined): number | null {
  if (!section) return null;
  const flat = section.trim().toUpperCase().replace(/[^A-Z]/g, "");
  const index = DAYS.indexOf(flat);
  return index === -1 ? null : index;
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
 * Is an item with this heading due on this night?
 *
 * True for everything that is not filed under a weekday, which is almost
 * everything. An unreadable night is treated as "due", because a list that
 * shows too much is recoverable and a list that quietly hides tonight's job
 * is not.
 */
export function dueOnNight(
  section: string | null | undefined,
  night: string,
): boolean {
  const day = dayOfSection(section);
  if (day === null) return true;
  const tonight = weekdayOfNight(night);
  if (tonight === null) return true;
  return day === tonight;
}

/**
 * Does this list schedule its items across the week?
 *
 * Used to decide whether a screen should explain itself. A list where nothing
 * is filed under a day should look exactly as it always has.
 */
export function hasDayScheduling(
  sections: (string | null | undefined)[],
): boolean {
  return sections.some((section) => dayOfSection(section) !== null);
}
