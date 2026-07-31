/**
 * Fixture checks for the report's arithmetic.
 *
 *   npm run check-rollup
 *
 * Every number on the rollup comes out of computeRollup, and the three
 * definitions it encodes are arguable — a night nobody opened counting against
 * every item, one list signed out of two not being a certified night. Cases
 * worked out by hand, so that changing a definition has to be deliberate.
 */
import { computeRollup, computeGroup } from "../.rollup-check/rollup-math.js";

let pass = 0, fail = 0;
const is = (label, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; } else { fail++; console.log(`  FAIL ${label}\n    got  ${a}\n    want ${b}`); }
};

// Three nights, one venue, one checklist of two items.
const W = ["2026-07-29", "2026-07-30", "2026-07-31"];
const checklists = [{ id: "L", venue_id: "V", house: "FOH", role: "MOD", phase: "close" }];
const items = [
  { id: "i1", checklist_id: "L", title: "Back door" },
  { id: "i2", checklist_id: "L", title: "Stanchions" },
];

// Night 1: certified, both ticked  -> c
// Night 2: certified, only i1      -> g
// Night 3: no row at all           -> m
const nights = [
  { id: "n1", checklist_id: "L", night: W[0], certified_at: "t", certified_by: "Ana" },
  { id: "n2", checklist_id: "L", night: W[1], certified_at: "t", certified_by: "Ana" },
];
const ticks = [
  { night_id: "n1", item_id: "i1" },
  { night_id: "n1", item_id: "i2" },
  { night_id: "n2", item_id: "i1" },
];
const r = computeRollup({ checklists, items, nights, ticks }, W);

is("strip", r.strip, "cgm");
is("certified", r.certified, 2);
is("nights", r.nights, 3);
// i1 open only on night 3; i2 open on nights 2 and 3.
is("missed", r.missed.map((m) => [m.item, m.open, m.of]), [["Stanchions", 2, 3], ["Back door", 1, 3]]);
// 2 items x 3 nights = 6 owed; 3 ticks.
is("byRole", r.byRole, [{ role: "MOD", done: 3, of: 6 }]);
is("certifiers", r.certifiers, [{ who: "Ana", nights: 2 }]);

// A night nobody opened must count against every item, not be skipped.
const none = computeRollup({ checklists, items, nights: [], ticks: [] }, W);
is("never opened: strip", none.strip, "mmm");
is("never opened: every item fully open", none.missed.map((m) => m.open), [3, 3]);
is("never opened: byRole", none.byRole, [{ role: "MOD", done: 0, of: 6 }]);

// A perfect window reports nothing missed rather than rows of zeroes.
const perfect = computeRollup({
  checklists, items,
  nights: W.map((n, i) => ({ id: `p${i}`, checklist_id: "L", night: n, certified_at: "t", certified_by: "Bo" })),
  ticks: W.flatMap((_, i) => items.map((it) => ({ night_id: `p${i}`, item_id: it.id }))),
}, W);
is("perfect: strip", perfect.strip, "ccc");
is("perfect: missed", perfect.missed, []);

// Two checklists: one signed, one not, is NOT a certified night.
const two = computeRollup({
  checklists: [...checklists, { id: "L2", venue_id: "V", house: "HOH", role: "Line", phase: "close" }],
  items: [...items, { id: "i3", checklist_id: "L2", title: "Hood filters" }],
  nights: [{ id: "n1", checklist_id: "L", night: W[0], certified_at: "t", certified_by: "Ana" }],
  ticks: [{ night_id: "n1", item_id: "i1" }, { night_id: "n1", item_id: "i2" }],
}, W);
is("partial signing is not certified", two.strip, "mmm");
is("partial signing: certified count", two.certified, 0);

// Group: two venues, ranked by share done.
const group = computeGroup({
  checklists: [
    { id: "L", venue_id: "V1", house: "FOH", role: "MOD", phase: "close" },
    { id: "M", venue_id: "V2", house: "FOH", role: "MOD", phase: "close" },
  ],
  items: [
    { id: "i1", checklist_id: "L", title: "A" },
    { id: "i2", checklist_id: "M", title: "A" },
  ],
  nights: [
    { id: "n1", checklist_id: "L", night: W[0], certified_at: "t", certified_by: "x" },
    { id: "n2", checklist_id: "M", night: W[0], certified_at: null, certified_by: null },
  ],
  ticks: [{ night_id: "n1", item_id: "i1" }],
}, W, new Map([["V1", "HAWK"], ["V2", "ISFO"]]));
is("group", group, [{ code: "HAWK", done: 1, of: 3 }, { code: "ISFO", done: 0, of: 3 }]);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
