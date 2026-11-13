/**
 * Which grade, if any, lets a house clear its finished work.
 *
 * Import-free on purpose, like the night maths, so scripts/check-reset.mjs can
 * prove it without a database.
 *
 * The promise to leaders is "once graded, one tap clears finished work". The
 * gate used to ask one question: has this house been graded for the week that
 * most recently finished? That is the right question on the Monday after a
 * grade and the wrong one every week after it.
 *
 * Craft & Commerce's kitchen filed ten on Oct 22. All ten were approved and
 * the week was graded. Nobody tapped reset. The next week the board was ten
 * approved tiles and nothing new, so there was nothing for the grader to grade
 * and he skipped it. From then on the gate asked for a grade on a week the
 * kitchen never filed in, the grader had nothing to grade because every slot
 * was full, and the slots stayed full because the gate would not open. Three
 * weeks at 0 of 10 with ten finished jobs on the board, and no button anyone
 * at the venue could press.
 *
 * So the gate asks about the work, not the calendar. Finished work can be
 * cleared once its house has been graded for the week that work was filed in,
 * or any week after it. The old answer still counts: a grade on the week that
 * most recently finished opens the gate as it always did, so nobody who could
 * reset before is stopped now.
 *
 * Weeks are ISO dates (the Monday), which sort as text.
 */

export type GradeRow = {
  weekStart: string;
  gradedAt: string;
  gradedBy: string;
};

/** The newest week among some finished work, or null when there is none. */
export function newestWeek(weeks: Iterable<string>): string | null {
  let newest: string | null = null;
  for (const week of weeks) {
    if (newest === null || week > newest) newest = week;
  }
  return newest;
}

/**
 * The grade that opens the reset for one house, or null while it waits.
 *
 * `grades` is that house's grades only. `workWeek` is the newest week its
 * finished work was filed in, null when nothing is finished. `completedWeek`
 * is the week that most recently closed: a grade can never be newer than that,
 * and one that claims to be is ignored rather than trusted.
 *
 * The newest grade that qualifies is the one returned, so the screen names the
 * most recent person who looked.
 */
export function resetGrade(
  grades: GradeRow[],
  workWeek: string | null,
  completedWeek: string,
): GradeRow | null {
  let found: GradeRow | null = null;
  for (const grade of grades) {
    if (grade.weekStart > completedWeek) continue;
    const opens =
      grade.weekStart === completedWeek ||
      (workWeek !== null && grade.weekStart >= workWeek);
    if (!opens) continue;
    if (found === null || grade.weekStart > found.weekStart) found = grade;
  }
  return found;
}
