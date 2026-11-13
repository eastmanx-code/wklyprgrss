/**
 * Fixture checks for the morning email text.
 *
 *   npm run check-recap
 *
 * This is the text a manager reads at nine in the morning to learn what the
 * crew missed. A wrong count starts an argument about the app; a missing item
 * name sends them into the app to look it up, which is the trip this exists to
 * save. The night is Polite Provisions, Tuesday 11/10, as it was recorded.
 */
import { calmName, nightRecap, recapDay } from "../.recap-check/night-recap.js";

let pass = 0,
  fail = 0;
const is = (label, got, want) => {
  if (got === want) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL ${label}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
  }
};

const list = (name, group, over = {}) => ({
  name,
  group,
  untouched: false,
  ticked: 0,
  owed: 0,
  checkedBy: [],
  signedBy: null,
  openTitles: [],
  openReason: null,
  ...over,
});
const done = (name, n) =>
  list(name, "done", { ticked: n, owed: n, checkedBy: ["AB"], signedBy: "Ana" });

// ------------------------------------------------------------------ the day

is("a Tuesday", recapDay("2026-11-10"), "Tuesday 11/10");
is("a Sunday in a single-digit month", recapDay("2026-03-01"), "Sunday 3/1");

// ----------------------------------------------------------------- the names

is("capitals are said quietly", calmName("MANAGER close"), "Manager close");
is("two words in capitals", calmName("DEEP CLEAN mid"), "Deep clean mid");
is("mixed case is left alone", calmName("YB Bartender close"), "YB Bartender close");
is("a room rides along", calmName("Deep clean · Hood mid"), "Deep clean · Hood mid");

// ------------------------------------------------------- Polite, Tuesday 11/10

const polite = [
  done("BAR close", 29),
  done("BARBACK close", 14),
  done("FLOOR close", 17),
  done("PREP close", 12),
  done("BAR open", 20),
  done("AMBIANCE open", 9),
  list("LEAD close", "unsigned", { untouched: true, owed: 10 }),
  list("DEEP CLEAN mid", "unsigned", { untouched: true, owed: 1 }),
  list("FLOOR open", "unsigned", { untouched: true, owed: 12 }),
  list("MANAGER close", "unsigned", {
    ticked: 17,
    owed: 19,
    checkedBy: ["DJ"],
    openTitles: [
      "I CONFIRMED THE HALLWAY WAS TIDY.",
      "I PLUGGED IN THE OFFICE IPOD TO CHARGE. ",
    ],
  }),
  // A weekly list not due tonight is not in the count at all.
  list("DEEP CLEAN · Patio mid", "empty"),
];

is(
  "the night, with the two missed items named",
  nightRecap("2026-11-10", polite),
  [
    "Tuesday 11/10: 6 of 10 closed and signed.",
    "",
    "NEVER OPENED",
    "- Lead close: 10 items, none checked off.",
    "- Deep clean mid: 1 item, none checked off.",
    "- Floor open: 12 items, none checked off.",
    "",
    "NEVER SIGNED",
    "- Manager close: 17 of 19, initials DJ. Missed:",
    "   - I CONFIRMED THE HALLWAY WAS TIDY.",
    "   - I PLUGGED IN THE OFFICE IPOD TO CHARGE.",
  ].join("\n"),
);

// -------------------------------------------------------------- other shapes

is(
  "a clean night",
  nightRecap("2026-11-10", [done("Bar close", 20), done("Floor close", 9)]),
  "Tuesday 11/10: 2 of 2 closed and signed.\n\nNo misses.",
);

is(
  "signed with items left, and the signer's reason",
  nightRecap("2026-11-10", [
    done("Bar close", 20),
    list("Host close", "gaps", {
      ticked: 7,
      owed: 8,
      checkedBy: ["KT"],
      signedBy: " Kim ",
      openTitles: ["ON SUNDAYS POUR 2 GALLONS OF WATER DOWN EACH OF THE BATHROOM FLOOR DRAINS"],
      openReason: "Out of buckets.",
    }),
  ]),
  [
    "Tuesday 11/10: 1 of 2 closed and signed.",
    "",
    "SIGNED WITH ITEMS LEFT",
    "- Host close: 7 of 8, signed by Kim. Missed:",
    "   - ON SUNDAYS POUR 2 GALLONS OF WATER DOWN EACH OF THE BATHROOM FLOOR DRAINS",
    "   Why: Out of buckets.",
  ].join("\n"),
);

is(
  "everything checked off and nobody signed",
  nightRecap("2026-11-10", [
    list("Dish close", "unsigned", { ticked: 8, owed: 8 }),
  ]),
  [
    "Tuesday 11/10: 0 of 1 closed and signed.",
    "",
    "NEVER SIGNED",
    "- Dish close: 8 of 8, no initials. Everything checked off, nobody signed.",
  ].join("\n"),
);

is(
  "a list still being walked after the roll is not a miss",
  nightRecap("2026-11-10", [
    done("Bar close", 20),
    list("Barback close", "going", { ticked: 9, owed: 14, checkedBy: ["RM"] }),
  ]),
  [
    "Tuesday 11/10: 1 of 2 closed and signed.",
    "",
    "No misses so far.",
    "",
    "STILL BEING WORKED",
    "- Barback close: 9 of 14.",
  ].join("\n"),
);

console.log(`check-recap: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
