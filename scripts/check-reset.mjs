/**
 * Fixture checks for when a house may clear its finished work.
 *
 *   npm run check-reset
 *
 * This decides whether a leader has a reset button or a notice saying to wait.
 * Too strict and a board fills with finished work nobody can clear, which is
 * what happened to a kitchen for three weeks. Too loose and a board is cleared
 * before anyone has judged the week, which is the one thing leaders were told
 * would not happen.
 *
 * The weeks are the real ones from Craft & Commerce in autumn 2026.
 */
import { newestWeek, resetGrade } from "../.reset-check/reset-gate.js";

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

const grade = (weekStart, gradedBy = "miguel") => ({
  weekStart,
  gradedAt: `${weekStart}T23:30:00Z`,
  gradedBy,
});
const weekOf = (row) => (row ? row.weekStart : null);

// ------------------------------------------------------------ newest week

is("no finished work has no week", newestWeek([]), null);
is("one week is that week", newestWeek(["2026-10-19"]), "2026-10-19");
is(
  "the newest of several, whatever the order",
  newestWeek(["2026-10-19", "2026-11-02", "2026-10-26"]),
  "2026-11-02",
);

// --------------------------------------------- the ordinary Monday reset

// Graded last Thursday, resetting this week. Opened before, opens now.
is(
  "graded for the week that just finished",
  weekOf(resetGrade([grade("2026-11-02")], "2026-11-02", "2026-11-02")),
  "2026-11-02",
);

// Not graded yet. Still waits.
is(
  "finished work, no grade anywhere",
  weekOf(resetGrade([], "2026-11-02", "2026-11-02")),
  null,
);

// Only an older grade, from before the work was filed. That grade judged a
// different week's work, so it does not open anything.
is(
  "a grade older than the work does not count",
  weekOf(resetGrade([grade("2026-10-26")], "2026-11-02", "2026-11-02")),
  null,
);

// ------------------------------------------------ the kitchen that got stuck

// Filed and graded the week of Oct 19, never reset, never graded again.
// Asked on Nov 12, when the week that most recently finished was Nov 2.
is(
  "graded for the week the work was filed in, weeks ago",
  weekOf(resetGrade([grade("2026-10-19")], "2026-10-19", "2026-11-02")),
  "2026-10-19",
);

// The same kitchen an hour later, after that Thursday's deadline rolled the
// finished week on to Nov 9. Still open.
is(
  "still open once another week closes",
  weekOf(resetGrade([grade("2026-10-19")], "2026-10-19", "2026-11-09")),
  "2026-10-19",
);

// Graded in a week after the work, but not the latest one.
is(
  "a grade after the work was filed counts",
  weekOf(resetGrade([grade("2026-10-26")], "2026-10-19", "2026-11-09")),
  "2026-10-26",
);

// ------------------------------------------------- nobody loses what they had

// Work approved early in a week that has not closed yet, with last week
// graded. The old gate opened here, so this one must.
is(
  "a grade on the finished week opens even for newer work",
  weekOf(resetGrade([grade("2026-11-02")], "2026-11-09", "2026-11-02")),
  "2026-11-02",
);

// Nothing finished at all, week graded. Same answer the old gate gave.
is(
  "no finished work, finished week graded",
  weekOf(resetGrade([grade("2026-11-02")], null, "2026-11-02")),
  "2026-11-02",
);
is(
  "no finished work, only an older grade",
  weekOf(resetGrade([grade("2026-10-19")], null, "2026-11-02")),
  null,
);

// ---------------------------------------------------------- which one is named

is(
  "the newest qualifying grade is the one named",
  resetGrade(
    [grade("2026-10-19", "miguel"), grade("2026-11-02", "BEASTMAN")],
    "2026-10-19",
    "2026-11-02",
  )?.gradedBy,
  "BEASTMAN",
);

// A grade dated after the week that most recently closed cannot be real.
is(
  "a grade from a week that has not closed is ignored",
  weekOf(resetGrade([grade("2026-11-16")], "2026-10-19", "2026-11-09")),
  null,
);

console.log(`check-reset: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
