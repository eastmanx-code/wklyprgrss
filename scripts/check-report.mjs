/**
 * Fixture checks for the weekly walkthrough card formatter.
 *
 *   npm run check-report
 *
 * The report is pasted into ClickUp by hand every week, so the rules that make
 * it paste cleanly are worth a test that needs no database: a missed board
 * reads FAIL and never a number, a walked-but-low board keeps its score, the
 * missed boards lead the needs list because a miss is the worst outcome, and no
 * item line ever carries a comma where ">" is meant to be the only delimiter.
 */
import {
  boardLabel,
  boardRank,
  buildReportText,
  word,
} from "../.report-check/report-format.js";

let pass = 0,
  fail = 0;
const is = (label, got, want) => {
  if (got === want) pass++;
  else {
    fail++;
    console.log(`  FAIL ${label}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
  }
};
const ok = (label, cond) => is(label, Boolean(cond), true);

// -------------------------------------------------------------- small helpers

is("word 0 is ZERO", word(0), "ZERO");
is("word 10 is TEN", word(10), "TEN");
is("word 13 falls back to digits", word(13), "13");

const missedBoard = {
  code: "BBBB",
  house: "FOH",
  built: 10,
  filed: 0,
  approved: 0,
  sentBack: 0,
  rolling: 0,
  missed: true,
  tier: "fail",
  authors: [],
  assists: [],
};
is("a missed board labels FAIL", boardLabel(missedBoard), "FAIL");
is("a missed board ranks below zero", boardRank(missedBoard), -1);
is(
  "a walked board labels its score",
  boardLabel({ ...missedBoard, missed: false, approved: 5 }),
  "5",
);

// ------------------------------------------------------------------ a full card

const board = (o) => ({
  built: 10,
  filed: 10,
  approved: 0,
  sentBack: 0,
  rolling: 0,
  missed: false,
  tier: "good",
  authors: [],
  assists: [],
  ...o,
});

const thisWeek = [
  board({
    code: "AAAA",
    house: "FOH",
    approved: 10,
    tier: "good",
    authors: [{ name: "Vlad", items: 10 }],
    assists: [
      { name: "Tom", items: 4 },
      { name: "Mel", items: 3 },
    ],
  }),
  board({ code: "BBBB", house: "FOH", filed: 0, approved: 0, missed: true, tier: "fail" }),
  board({
    code: "CCCC",
    house: "FOH",
    approved: 5,
    tier: "fail",
    authors: [{ name: "Lamar", items: 10 }],
  }),
  board({
    code: "DDDD",
    house: "FOH",
    approved: 7,
    tier: "neutral",
    authors: [{ name: "Nate", items: 10 }],
  }),
  board({
    code: "EEEE",
    house: "HOH",
    approved: 9,
    tier: "good",
    authors: [{ name: "Javier", items: 10 }],
  }),
];

const lastWeek = [
  board({ code: "AAAA", house: "FOH", approved: 10, tier: "good" }),
  board({ code: "BBBB", house: "FOH", approved: 9, tier: "good" }),
  board({ code: "CCCC", house: "FOH", approved: 7, tier: "neutral" }),
  board({ code: "DDDD", house: "FOH", filed: 0, approved: 0, missed: true, tier: "fail" }),
  board({ code: "EEEE", house: "HOH", filed: 0, approved: 0, missed: true, tier: "fail" }),
];

const text = buildReportText({ weekLabel: "Sep 28", thisWeek, lastWeek });
const lines = text.split("\n");
const has = (s) => text.includes(s);

// Tally: AAAA good, DDDD neutral, BBBB + CCCC fail, over four boards.
ok("FOH tally header", has("**FRONT OF HOUSE > WEEK TALLY**"));
ok("FOH wins 1", has("* WINS > 1"));
ok("FOH neutrals 1", has("* NEUTRALS > 1"));
ok("FOH fails 2", has("* FAILS > 2"));
ok("FOH win rate 25%", has("* WIN RATE > 25%"));
ok("FOH fail rate 50%", has("* FAIL RATE > 50%"));

// Movement, exact.
ok("DDDD climbed from a fail", has("DDDD FROM FAIL TO 7"));
ok("BBBB fell to a fail", has("BBBB FROM 9 TO FAIL"));
ok("CCCC slipped on score", has("CCCC FROM 7 TO 5"));
ok("AAAA held the top", /\* HELD TOP > [^\n]*AAAA/.test(text));

// Good performance line, with filer and assists spelled out.
ok("good line for AAAA", has("* AAAA > 10 > VLAD FILED ALL TEN > TOM AND MEL BEHIND"));

// Needs: the missed board leads the walked-but-low one.
const idxMissed = text.indexOf("* BBBB > FAIL > MISSED 4PM");
const idxLow = text.indexOf("* CCCC > 5 >");
ok("missed board is in needs", idxMissed >= 0);
ok("walked-low board is in needs", idxLow >= 0);
ok("missed is ranked above walked-low", idxMissed < idxLow);
ok("walked-low keeps its credit", has("WALKED ON TIME AND CAME IN LOW"));

// The comeback is called out.
ok("comeback shout out", has("(EEEE)") && has("FROM A FAIL TO A 9"));

// Format rules: bold headers, bullet lines, and never a comma inside a line.
ok("headers are bold not markdown", has("**FRONT OF HOUSE > GOOD PERFORMANCE**"));
ok("no literal markdown heading", !has("## "));
ok("excluded line present", has("**EXCLUDED THIS WEEK: NONE**"));
const bulletWithComma = lines.find((l) => l.startsWith("* ") && l.includes(","));
is("no bullet line carries a comma", bulletWithComma ?? null, null);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
