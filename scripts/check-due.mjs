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
  cadenceOf,
  cadenceOwedTonight,
  dayOfSection,
  dueOnNight,
  hasDayScheduling,
  makeCadenceDue,
  periodStartOf,
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

// ------------------------------------------------------ an explicit day set

// 2026-09-07 is a Monday, -11 a Friday, -12 a Saturday, -13 a Sunday.
const WEEKEND = ["FRIDAY", "SATURDAY"];
const WEEKNIGHTS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"];

// A SERVER list that only fires on the weekend.
is("weekend set is due Friday", dueOnNight(null, "2026-09-11", WEEKEND), true);
is("weekend set is due Saturday", dueOnNight(null, "2026-09-12", WEEKEND), true);
is("weekend set is not due Monday", dueOnNight(null, "2026-09-07", WEEKEND), false);
is("weekend set is not due Sunday", dueOnNight(null, "2026-09-13", WEEKEND), false);

// The four bar-close jobs the server takes over, owed the other five nights.
is("weeknights are due Monday", dueOnNight(null, "2026-09-07", WEEKNIGHTS), true);
is("weeknights are due Sunday", dueOnNight(null, "2026-09-13", WEEKNIGHTS), true);
is("weeknights are not due Friday", dueOnNight(null, "2026-09-11", WEEKNIGHTS), false);
is("weeknights are not due Saturday", dueOnNight(null, "2026-09-12", WEEKNIGHTS), false);

// A day set wins over a heading. The heading is a label here, not the schedule.
is("a day set beats a weekday heading", dueOnNight("MONDAY", "2026-09-11", WEEKEND), true);
is("and hides it on the heading's own day", dueOnNight("MONDAY", "2026-09-07", WEEKEND), false);

// Read as forgivingly as a heading.
is("a day set is case-insensitive", dueOnNight(null, "2026-09-11", ["friday"]), true);
is("a day set ignores spacing", dueOnNight(null, "2026-09-11", ["  Friday  "]), true);

// An empty set is "every night", so the heading, or nothing, decides.
is("an empty set falls back to the heading", dueOnNight("MONDAY", "2026-09-07", []), true);
is("an empty set with no heading is always due", dueOnNight(null, "2026-09-11", []), true);

// Too much is recoverable; hiding tonight's job is not.
is("an unreadable night with a day set shows it", dueOnNight(null, "garbage", WEEKEND), true);
// An entry that is not a weekday is no night and matches nothing.
is("a non-day entry matches nothing", dueOnNight(null, "2026-09-11", ["PAYDAY"]), false);

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

// ------------------------------------------ more than one day, weeks of month

// Multi-day, every week. The to-go condiments run Tuesday, Friday, Saturday.
is("multi-day due Tuesday", dueOnNight("TUESDAY AND FRIDAY AND SATURDAY", "2026-10-06"), true);
is("multi-day due Friday", dueOnNight("TUESDAY AND FRIDAY AND SATURDAY", "2026-10-09"), true);
is("multi-day due Saturday", dueOnNight("TUESDAY AND FRIDAY AND SATURDAY", "2026-10-10"), true);
is("multi-day skips Monday", dueOnNight("TUESDAY AND FRIDAY AND SATURDAY", "2026-10-05"), false);
is("multi-day skips Wednesday", dueOnNight("TUESDAY AND FRIDAY AND SATURDAY", "2026-10-07"), false);

// Short day words and a slash delimiter read the same.
is("WED AND SUN due Wednesday", dueOnNight("WED AND SUN", "2026-10-07"), true);
is("WED/SUN due Sunday", dueOnNight("WED/SUN", "2026-10-11"), true);
is("WED/SUN skips Monday", dueOnNight("WED/SUN", "2026-10-05"), false);

// Monthly. The bar's compartment clean is the first and third Mondays only.
// October 2026 Mondays: 5th is the 1st, 12th the 2nd, 19th the 3rd, 26th the 4th.
is("first and third due 1st Monday", dueOnNight("FIRST AND THIRD MONDAYS", "2026-10-05"), true);
is("first and third due 3rd Monday", dueOnNight("FIRST AND THIRD MONDAYS", "2026-10-19"), true);
is("first and third skips 2nd Monday", dueOnNight("FIRST AND THIRD MONDAYS", "2026-10-12"), false);
is("first and third skips 4th Monday", dueOnNight("FIRST AND THIRD MONDAYS", "2026-10-26"), false);
is("first and third skips Tuesday", dueOnNight("FIRST AND THIRD MONDAYS", "2026-10-06"), false);
is("of the month is just a connector", dueOnNight("FIRST AND THIRD MONDAYS OF THE MONTH", "2026-10-05"), true);

// The last occurrence, where a fifth one exists. October 2026 Fridays run to
// the 30th, which is the fifth and the last.
is("last Friday due on the fifth", dueOnNight("LAST FRIDAY", "2026-10-30"), true);
is("last Friday skips the fourth", dueOnNight("LAST FRIDAY", "2026-10-23"), false);

// A single ordinal. October 2026 second Tuesday is the 13th.
is("second Tuesday due", dueOnNight("SECOND TUESDAY", "2026-10-13"), true);
is("second Tuesday skips the first", dueOnNight("SECOND TUESDAY", "2026-10-06"), false);

// A grouping that merely contains an ordinal word is still a grouping.
is("WELL 2 is not a schedule", dueOnNight("WELL 2", "2026-10-05"), true);
is("SECOND SEATING is not a schedule", dueOnNight("SECOND SEATING", "2026-10-05"), true);

// The carry grouping follows a lone weekday only, never a multi or monthly row.
is("a plain weekday still reads as its day", dayOfSection("MONDAY"), 1);
is("a multi-day heading is not one day", dayOfSection("TUESDAY AND FRIDAY"), null);
is("a monthly heading is not one day", dayOfSection("FIRST AND THIRD MONDAYS"), null);

// The richer headings still count as scheduling for the screen hint.
is("a monthly list schedules", hasDayScheduling(["FIRST AND THIRD MONDAYS"]), true);
is("a multi-day list schedules", hasDayScheduling(["WED AND SUN"]), true);

// --------------------------------------------------------- reading a cadence

// WEEKLY and MONTHLY are cadences; everything else is not.
is("WEEKLY is a weekly cadence", cadenceOf("WEEKLY"), "weekly");
is("MONTHLY is a monthly cadence", cadenceOf("MONTHLY"), "monthly");
is("case does not matter for cadence", cadenceOf("weekly"), "weekly");
is("no heading is no cadence", cadenceOf(null), null);
is("an empty heading is no cadence", cadenceOf(""), null);
// A stray word makes it an ordinary grouping again, owed every night.
is("WEEKLY DEEP CLEAN is not a cadence", cadenceOf("WEEKLY DEEP CLEAN"), null);
is("a weekday is not a cadence", cadenceOf("MONDAY"), null);
is("a grouping is not a cadence", cadenceOf("CLOSING SQUAD"), null);

// ---------------------------------------------------------- reading a period

// 2026-09-07 is a Monday. The week is Monday-anchored.
is("Monday starts its own week", periodStartOf("weekly", "2026-09-07"), "2026-09-07");
is("Wednesday rolls back to Monday", periodStartOf("weekly", "2026-09-09"), "2026-09-07");
is("Sunday still belongs to that Monday", periodStartOf("weekly", "2026-09-13"), "2026-09-07");
is("the next Monday starts a new week", periodStartOf("weekly", "2026-09-14"), "2026-09-14");
is("the month period is the first", periodStartOf("monthly", "2026-09-13"), "2026-09-01");
is("an unreadable night has no week", periodStartOf("weekly", "nope"), null);

// ------------------------------------------------ owed tonight, the crew rule

// A weekly item is owed every night until it is done once this week, then it
// clears. Tonight's own tick does not count as "earlier", so it still shows.
is("weekly owed when not yet done", cadenceOwedTonight("WEEKLY", "2026-09-07", null, false), true);
is("weekly clears once done earlier", cadenceOwedTonight("WEEKLY", "2026-09-09", null, true), false);
// A non-cadence item ignores the flag and answers the ordinary way.
is("a weekday item still reads its day", cadenceOwedTonight("MONDAY", "2026-09-07", null, true), true);
is("a plain item is owed whatever the flag", cadenceOwedTonight(null, "2026-09-07", null, true), true);

// --------------------------------------------- the cadence rule a report scores

{
  // One weekly item, a full Monday-to-Sunday week the venue was open every
  // night, scored from the following week so the period has closed.
  const week = [
    "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10",
    "2026-09-11", "2026-09-12", "2026-09-13",
  ];
  const base = {
    cadenceByItem: new Map([["w", "weekly"]]),
    runningNightsByItem: new Map([["w", week]]),
    today: "2026-09-20",
  };

  // Done on Wednesday: due on that one night, nowhere else.
  const done = makeCadenceDue({
    ...base,
    tickNightsByItem: new Map([["w", ["2026-09-09"]]]),
  });
  is("a done weekly is due on its tick night", done({ id: "w", section: "WEEKLY" }, "2026-09-09"), true);
  is("a done weekly is not due the night before", done({ id: "w", section: "WEEKLY" }, "2026-09-08"), false);
  is("a done weekly is not due the night after", done({ id: "w", section: "WEEKLY" }, "2026-09-10"), false);

  // Never done, week closed: one miss, on the last night the venue was open.
  const missed = makeCadenceDue({ ...base, tickNightsByItem: new Map() });
  is("an undone weekly lands on the week's last running night", missed({ id: "w", section: "WEEKLY" }, "2026-09-13"), true);
  is("an undone weekly is not due midweek", missed({ id: "w", section: "WEEKLY" }, "2026-09-10"), false);

  // Venue dark on Sunday: the miss lands on Saturday, the last night it was open.
  const darkSunday = makeCadenceDue({
    ...base,
    runningNightsByItem: new Map([["w", week.slice(0, 6)]]),
    tickNightsByItem: new Map(),
  });
  is("the miss follows the last open night", darkSunday({ id: "w", section: "WEEKLY" }, "2026-09-12"), true);
  is("and not the dark Sunday", darkSunday({ id: "w", section: "WEEKLY" }, "2026-09-13"), false);

  // Week still open (scored from inside it) and not yet done: due on no night,
  // so it is neither done nor missed until the week is actually over.
  const openWeek = makeCadenceDue({
    ...base,
    today: "2026-09-10",
    tickNightsByItem: new Map(),
  });
  is("an open undone weekly is due on no night", openWeek({ id: "w", section: "WEEKLY" }, "2026-09-07"), false);
  is("even on the latest night so far", openWeek({ id: "w", section: "WEEKLY" }, "2026-09-09"), false);

  // A non-cadence item in the same resolver keeps the ordinary weekday rule.
  is("a non-cadence item delegates to its day", done({ id: "x", section: "MONDAY" }, "2026-09-07"), true);
  is("a non-cadence Tuesday is not due Monday", done({ id: "x", section: "TUESDAY" }, "2026-09-07"), false);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
