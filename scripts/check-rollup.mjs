/**
 * Fixture checks for the report's arithmetic.
 *
 *   npm run check-rollup
 *
 * Every number on the rollup comes out of computeRollup, and the definitions
 * it encodes are arguable: which nights count at all, a night nobody opened
 * the list counting against every item on it, one list signed out of two not
 * being a certified night. Cases worked out by hand, so that changing a
 * definition has to be deliberate.
 */
import { computeRollup, computeGroup } from "../.rollup-check/rollup-math.js";
// The same rule the app passes in, so these cases prove what actually runs
// rather than a copy of it.
import { dueOnNight } from "../.rollup-check/due.js";

const isDue = (item, night) => dueOnNight(item.section, night);

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

// Night 3 has no row anywhere, so the venue was not running: two nights count.
// The strip is about signing: every list was signed on both, gaps or not.
is("strip", r.strip, "cc");
is("certified", r.certified, 2);
is("nights", r.nights, 2);
is("lists signed over the running nights", [r.signed, r.owed], [2, 2]);
is("nothing unsigned on the latest night", r.unsigned, { night: W[1], lists: [] });
// i1 ticked both nights and so is not on the list at all; i2 open on night 2.
is("missed", r.missed.map((m) => [m.item, m.open, m.of]), [["Stanchions", 1, 2]]);
// 2 items x 2 nights = 4 owed; 3 ticks.
is("byRole", r.byRole, [{ role: "MOD", done: 3, of: 4, opened: 2, nights: 2 }]);
is("certifiers", r.certifiers, [{ who: "Ana", nights: 2 }]);

// ------------------------------------------------------- which nights count
//
// The venue was running — another of its lists has a row — but this list was
// never opened. Those nights still count against every item on it. That is
// the whole point of the panel and the part that must not be softened.
{
  const line = { id: "L2", venue_id: "V", house: "HOH", role: "Line", phase: "close" };
  const ranAll = W.map((n, i) => ({ id: `o${i}`, checklist_id: "L2", night: n, certified_at: "t", certified_by: "Bo" }));
  const ignored = computeRollup({ checklists: [...checklists, line], items, nights: ranAll, ticks: [] }, W);
  is("ignored list: the venue ran three nights", ignored.nights, 3);
  is("ignored list: every item fully open", ignored.missed.map((m) => m.open), [3, 3]);
  // The number that explains a bad bar: the list was never opened.
  is("ignored list: byRole says the list was not opened", ignored.byRole, [{ role: "MOD", done: 0, of: 6, opened: 0, nights: 3 }]);
  is("ignored list: half the lists signed reads as half or fewer", ignored.strip, "mmm");
  is("ignored list: three of six signed", [ignored.signed, ignored.owed], [3, 6]);
  // The question a manager asks of "3 of 6" is which ones. Named, with the
  // room where there is one, so three deep cleans do not read as one word.
  is("ignored list: the unsigned one is named", ignored.unsigned, {
    night: W[2],
    lists: [{ role: "MOD", room: null, phase: "close" }],
  });
}

// A venue in its first week is not thirty of thirty on every line. Nights
// before it joined, and nights it was dark, are not nights it missed
// anything — and a panel where everything ties at 100% ranks nothing.
{
  const firstWeek = computeRollup(
    { checklists, items, nights: [nights[1]], ticks: [{ night_id: "n2", item_id: "i1" }] },
    W,
  );
  is("first week: only the nights it ran", firstWeek.nights, 1);
  is("first week: strip is one night long", firstWeek.strip, "c");
  is("first week: one item, one night, once", firstWeek.missed.map((m) => [m.item, m.open, m.of]), [["Stanchions", 1, 1]]);
  is("first week: byRole", firstWeek.byRole, [{ role: "MOD", done: 1, of: 2, opened: 1, nights: 1 }]);
}

// Nothing recorded at all. The caller shows the one honest line instead of
// this, but the arithmetic must not invent a window to fill.
{
  const silent = computeRollup({ checklists, items, nights: [], ticks: [] }, W);
  is("nothing recorded: no nights", silent.nights, 0);
  is("nothing recorded: nothing to rank", silent.missed, []);
  is("nothing recorded: no strip", silent.strip, "");
  is("nothing recorded: no roles", silent.byRole, []);
}

// Most of the lists signed is its own state: not every one, not half or
// fewer. Three lists, two signed.
{
  const three = [
    ...checklists,
    { id: "L2", venue_id: "V", house: "HOH", role: "Line", phase: "close" },
    { id: "L3", venue_id: "V", house: "FOH", role: "Deep clean", phase: "mid", room: "Noble" },
  ];
  const most = computeRollup({
    checklists: three, items,
    nights: [
      { id: "n1", checklist_id: "L", night: W[0], certified_at: "t", certified_by: "Ana" },
      { id: "n2", checklist_id: "L2", night: W[0], certified_at: "t", certified_by: "Bo" },
      { id: "n3", checklist_id: "L3", night: W[0], certified_at: null, certified_by: null },
    ],
    ticks: [],
  }, W);
  is("most signed", most.strip, "g");
  is("two of three", [most.signed, most.owed], [2, 3]);
  is("the deep clean is named with its room", most.unsigned, {
    night: W[0],
    lists: [{ role: "Deep clean", room: "Noble", phase: "mid" }],
  });
}

// Ranked by how many nights, not by what share. A deep clean job owed one
// night and missed once sat at 100% above restrooms missed three nights out
// of four, on a panel called "what keeps getting left open".
{
  const four = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30"];
  const lists = [
    { id: "H", venue_id: "V", house: "FOH", role: "Host", phase: "close" },
    { id: "D", venue_id: "V", house: "FOH", role: "Deep clean", phase: "mid", room: "Hood" },
  ];
  const rows = [
    { id: "rest", checklist_id: "H", title: "Restrooms" },
    // 2026-07-27 is a Monday: owed once in these four nights.
    { id: "dust", checklist_id: "D", title: "Dust the shelves", section: "MONDAY" },
  ];
  const opened = four.flatMap((n, i) => [
    { id: `h${i}`, checklist_id: "H", night: n, certified_at: "t", certified_by: "x" },
    { id: `d${i}`, checklist_id: "D", night: n, certified_at: "t", certified_by: "x" },
  ]);
  // Restrooms done once in four. The deep clean never.
  const ranked = computeRollup({ checklists: lists, items: rows, nights: opened, ticks: [{ night_id: "h3", item_id: "rest" }] }, four, isDue);
  is("three of four outranks one of one",
    ranked.missed.map((m) => [m.item, m.open, m.of]),
    [["Restrooms", 3, 4], ["Dust the shelves", 1, 1]]);
}

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
is("partial signing is not certified", two.strip, "m");
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
is("group", group, [{ code: "HAWK", done: 1, of: 1 }, { code: "ISFO", done: 0, of: 1 }]);

// Two venues that joined in different weeks are each scored over their own
// nights. One set of running nights shared between them would mark the newer
// venue down for the nights the older one was open.
{
  const staggered = computeGroup({
    checklists: [
      { id: "L", venue_id: "V1", house: "FOH", role: "MOD", phase: "close" },
      { id: "M", venue_id: "V2", house: "FOH", role: "MOD", phase: "close" },
    ],
    items: [
      { id: "i1", checklist_id: "L", title: "A" },
      { id: "i2", checklist_id: "M", title: "A" },
    ],
    nights: [
      // V1 has been running all three nights and does it every night.
      ...W.map((n, i) => ({ id: `a${i}`, checklist_id: "L", night: n, certified_at: "t", certified_by: "x" })),
      // V2 joined on the last night and did it.
      { id: "b2", checklist_id: "M", night: W[2], certified_at: "t", certified_by: "y" },
    ],
    ticks: [
      ...W.map((_, i) => ({ night_id: `a${i}`, item_id: "i1" })),
      { night_id: "b2", item_id: "i2" },
    ],
  }, W, new Map([["V1", "HAWK"], ["V2", "ISFO"]]));
  is("staggered joins", staggered, [{ code: "HAWK", done: 3, of: 3 }, { code: "ISFO", done: 1, of: 1 }]);
}

// ------------------------------------------------------- the deep clean rota
//
// A heading that names a weekday means the item is owed that night and no
// other. Counting a deep clean item against all seven nights was what made a
// finished job read as six sevenths missed, put those items at the top of the
// list of things nobody does, and marked the venue down for running the list
// exactly as it is written.
{
  // A full week. 2026-07-27 is a Monday.
  const week = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"];
  const deep = [{ id: "D", venue_id: "V", house: "FOH", role: "Bar deep clean", phase: "mid" }];
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  const rota = days.map((section, i) => ({ id: `d${i}`, checklist_id: "D", title: section, section }));
  const opened = week.map((n, i) => ({ id: `w${i}`, checklist_id: "D", night: n, certified_at: "t", certified_by: "Cy" }));
  const allTicks = rota.map((item, i) => ({ night_id: `w${i}`, item_id: item.id }));

  // Nobody does any of it: each item is owed once in the week, missed once.
  const nothing = computeRollup({ checklists: deep, items: rota, nights: opened, ticks: [] }, week, isDue);
  is("rota: each item owed one night in seven", [...new Set(nothing.missed.map((m) => m.of))], [1]);
  is("rota: seven items each missed once", nothing.missed.length, 7);
  is("rota: the week is seven owed not forty nine", nothing.byRole, [{ role: "Bar deep clean", done: 0, of: 7, opened: 7, nights: 7 }]);

  // The week done exactly as written: one item a night, on its own day.
  const asWritten = computeRollup({ checklists: deep, items: rota, nights: opened, ticks: allTicks }, week, isDue);
  is("rota: doing it right reports nothing missed", asWritten.missed, []);
  is("rota: and reads as complete", asWritten.byRole, [{ role: "Bar deep clean", done: 7, of: 7, opened: 7, nights: 7 }]);
  is("rota: the venue is not marked down for it",
    computeGroup({ checklists: deep, items: rota, nights: opened, ticks: allTicks }, week, new Map([["V", "HOOD"]]), isDue),
    [{ code: "HOOD", done: 7, of: 7 }]);

  // Only Monday's done.
  const mondayOnly = computeRollup({ checklists: deep, items: rota, nights: opened, ticks: [{ night_id: "w0", item_id: "d0" }] }, week, isDue);
  is("rota: Monday done leaves six owed", mondayOnly.missed.length, 6);
  is("rota: and Monday is not among them", mondayOnly.missed.some((m) => m.item === "MONDAY"), false);
  is("rota: one of seven", mondayOnly.byRole, [{ role: "Bar deep clean", done: 1, of: 7, opened: 7, nights: 7 }]);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
