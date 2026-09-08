/**
 * Fixture checks for which items are due on a given night.
 *
 *   npm run check-due
 *
 * This decides what a list asks of somebody. Too strict and tonight's job
 * disappears off the screen; too loose and the deep clean goes back to
 * reporting a finished shift as 0 of 7.
 *
 * The headings here are the real ones from production, day names on the two
 * deep clean lists and plain groupings everywhere else.
 */
import {
  dayOfSection,
  dueOnNight,
  hasDayScheduling,
  weekdayOfNight,
} from "../.due-check/due.js";

let pass = 0,
  fail = 0;
const is = (label, got, want) => {
  if (got === want) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL ${label}\n    got  ${got}\n    want ${want}`);
  }
};

// -------------------------------------------------------- reading a heading

is("MONDAY is Monday", dayOfSection("MONDAY"), 1);
is("SUNDAY is zero, like getUTCDay", dayOfSection("SUNDAY"), 0);
is("SATURDAY is six", dayOfSection("SATURDAY"), 6);
is("case does not matter", dayOfSection("Monday"), 1);
is("a colon does not matter", dayOfSection("MONDAY:"), 1);
is("spacing does not matter", dayOfSection("  friday  "), 5);

// The other real headings. None of these is a schedule.
is("CLOSING SQUAD is not a day", dayOfSection("CLOSING SQUAD"), null);
is("FIRST CUTS is not a day", dayOfSection("FIRST CUTS"), null);
is("DAILY is not a day", dayOfSection("DAILY"), null);
is("WEEKLY is not a day", dayOfSection("WEEKLY"), null);
is("no heading is not a day", dayOfSection(null), null);
is("an empty heading is not a day", dayOfSection(""), null);
// Guard against matching a heading that merely contains a day name.
is("MONDAY PREP is not a day", dayOfSection("MONDAY PREP"), null);
is("BEFORE FRIDAY is not a day", dayOfSection("BEFORE FRIDAY"), null);

// ---------------------------------------------------------- reading a night

// 2026-09-07 is a Monday, the night the app launched at Hood.
is("the launch night was a Monday", weekdayOfNight("2026-09-07"), 1);
is("the night after was a Tuesday", weekdayOfNight("2026-09-08"), 2);
is("a Sunday reads as zero", weekdayOfNight("2026-09-13"), 0);
is("a Saturday reads as six", weekdayOfNight("2026-09-12"), 6);
// Across the winter clock change, where an offset bug would show up.
is("a night in January", weekdayOfNight("2026-01-15"), 4);
is("nonsense is nothing", weekdayOfNight("not a date"), null);
is("an empty night is nothing", weekdayOfNight(""), null);

// --------------------------------------------------------------- what is due

// The real case: seven deep clean items, one night, one of them due.
{
  const week = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ];
  const monday = week.filter((s) => dueOnNight(s, "2026-09-07"));
  is("one of seven is due on a Monday", monday.length, 1);
  is("and it is Monday's", monday[0], "MONDAY");

  const sunday = week.filter((s) => dueOnNight(s, "2026-09-13"));
  is("one of seven is due on a Sunday", sunday.length, 1);
  is("and it is Sunday's", sunday[0], "SUNDAY");
}

// Everything that is not filed under a day is due whenever the list is walked,
// which is what keeps every ordinary list behaving as it always has.
is("no heading is always due", dueOnNight(null, "2026-09-07"), true);
is("a grouping is always due", dueOnNight("CLOSING SQUAD", "2026-09-07"), true);
is("a grouping is due on any night", dueOnNight("FIRST CUTS", "2026-09-13"), true);

// A night the app cannot read must not hide tonight's work. Showing too much
// is recoverable; quietly dropping the job is not.
is("an unreadable night shows everything", dueOnNight("MONDAY", "garbage"), true);

// The night, not the clock. Work done at 1am Tuesday is Monday's night, and
// currentNight hands this "2026-09-07", so Monday's item is still the one due.
is("1am Tuesday still owes Monday", dueOnNight("MONDAY", "2026-09-07"), true);
is("1am Tuesday does not owe Tuesday", dueOnNight("TUESDAY", "2026-09-07"), false);

// --------------------------------------------------------- does a list schedule

is(
  "a deep clean list schedules",
  hasDayScheduling(["MONDAY", "TUESDAY", "SUNDAY"]),
  true,
);
is(
  "a close list does not",
  hasDayScheduling([null, "CLOSING SQUAD", "FIRST CUTS", null]),
  false,
);
is("an empty list does not", hasDayScheduling([]), false);
// YB weekly sidework: seven items, no headings at all. Until somebody says
// which days those belong to, it behaves like every other list.
is("YB sidework does not schedule", hasDayScheduling([null, null, null]), false);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
