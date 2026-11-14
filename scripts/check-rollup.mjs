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
import {
  chunksOf,
  computeGroup,
  computeRollup,
  nightsNeedingTicks,
  tickNightsOf,
} from "../.rollup-check/rollup-math.js";
// The same rule the app passes in, so these cases prove what actually runs
// rather than a copy of it.
import { cadenceOf, dueOnNight, makeCadenceDue } from "../.rollup-check/due.js";

const isCadence = (item) => cadenceOf(item.section) !== null;

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

// Night 1: certified, both ticked  -> done and signed        -> c
// Night 2: certified, only i1      -> signed, not done       -> m
// Night 3: no row at all           -> the venue was not running
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
// One ruler: a list is done and signed or it is not. Night 2 was signed with
// a thing left on it, so it is not.
is("strip", r.strip, "cm");
is("certified", r.certified, 1);
is("nights", r.nights, 2);
is("lists done and signed over the running nights", [r.done, r.of], [1, 2]);
// Which one, and which way it fell short: signed, not done.
is("latest night: not done is named, with who signed it", r.latest, {
  night: W[1],
  neverOpened: [],
  neverSigned: [],
  notDone: [{ role: "MOD", room: null, phase: "close", by: "Ana" }],
});
// i1 ticked both nights and so is not on the list at all; i2 open on night 2.
is("missed", r.missed.map((m) => [m.item, m.open, m.of]), [["Stanchions", 1, 2]]);
// Stanchions was open on night two, which Ana signed off anyway, so she is
// named as having signed it short once, and no open night went unsigned.
is("missed names who signed it off short",
  r.missed.map((m) => [m.item, m.signedShortBy, m.unsignedNights]),
  [["Stanchions", [{ who: "Ana", nights: 1 }], 0]]);
// The same ruler per position: one list, two nights, done and signed once.
is("byRole", r.byRole, [{ role: "MOD", done: 1, of: 2 }]);
is("certifiers", r.certifiers, [{ who: "Ana", nights: 2 }]);
// Per running night, the share done and signed. One list, so of is one each
// night: done on night one, short on night two.
is("series", r.series, [
  { night: W[0], done: 1, of: 1 },
  { night: W[1], done: 0, of: 1 },
]);
// Stanchions was done night one and missed night two, so it is on a one-night
// streak, and one of the two recent nights it was owed.
is("missed carries streak and the recent window",
  r.missed.map((m) => [m.item, m.streak, m.recentOpen, m.recentOf]),
  [["Stanchions", 1, 1, 2]]);

// ------------------------------------------------------- which nights count
//
// The venue was running — another of its lists has a row — but this list was
// never opened. Those nights still count against every item on it. That is
// the whole point of the panel and the part that must not be softened.
{
  const line = { id: "L2", venue_id: "V", house: "HOH", role: "Line", phase: "close" };
  const ranAll = W.map((n, i) => ({ id: `o${i}`, checklist_id: "L2", night: n, certified_at: "t", certified_by: "Bo" }));
  // The line has one item and did it every night. A list with nothing written
  // on it would be on no night's bill at all: see "on the bill" below.
  const lineItem = { id: "l1", checklist_id: "L2", title: "Line wiped" };
  const ignored = computeRollup({
    checklists: [...checklists, line], items: [...items, lineItem], nights: ranAll,
    ticks: ranAll.map((n) => ({ night_id: n.id, item_id: "l1" })),
  }, W);
  is("ignored list: the venue ran three nights", ignored.nights, 3);
  is("ignored list: every item fully open", ignored.missed.map((m) => m.open), [3, 3]);
  // Ranked worst first: the list nobody opened is nought of three, the one
  // that was done every night is three of three.
  is("ignored list: byRole", ignored.byRole, [
    { role: "Line", done: 3, of: 3 },
    { role: "MOD", done: 0, of: 3 },
  ]);
  is("ignored list: one list short is a short night", ignored.strip, "mmm");
  is("ignored list: three of six done and signed", [ignored.done, ignored.of], [3, 6]);
  // The question a manager asks of "3 of 6" is which ones. Named, with the
  // room where there is one, so three deep cleans do not read as one word.
  is("ignored list: the unsigned one is named", ignored.latest, {
    night: W[2],
    neverOpened: [{ role: "MOD", room: null, phase: "close" }],
    neverSigned: [],
    notDone: [],
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
  is("first week: strip is one night long", firstWeek.strip, "m");
  is("first week: one item, one night, once", firstWeek.missed.map((m) => [m.item, m.open, m.of]), [["Stanchions", 1, 1]]);
  is("first week: byRole", firstWeek.byRole, [{ role: "MOD", done: 0, of: 1 }]);
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

// Two buckets, no third. Three lists, two done and signed and one nobody
// signed, is a short night, the same as none.
{
  const three = [
    ...checklists,
    { id: "L2", venue_id: "V", house: "HOH", role: "Line", phase: "close" },
    { id: "L3", venue_id: "V", house: "FOH", role: "Deep clean", phase: "mid", room: "Noble" },
  ];
  const most = computeRollup({
    checklists: three,
    items: [
      ...items,
      { id: "l1", checklist_id: "L2", title: "Line wiped" },
      { id: "d1", checklist_id: "L3", title: "Noble back bar" },
    ],
    nights: [
      { id: "n1", checklist_id: "L", night: W[0], certified_at: "t", certified_by: "Ana" },
      { id: "n2", checklist_id: "L2", night: W[0], certified_at: "t", certified_by: "Bo" },
      { id: "n3", checklist_id: "L3", night: W[0], certified_at: null, certified_by: null },
    ],
    // MOD's two items and the line's one all ticked; the deep clean untouched.
    ticks: [
      { night_id: "n1", item_id: "i1" }, { night_id: "n1", item_id: "i2" },
      { night_id: "n2", item_id: "l1" },
    ],
  }, W);
  is("most done and signed is still short", most.strip, "m");
  is("two of three", [most.done, most.of], [2, 3]);
  is("the deep clean is named with its room", most.latest, {
    night: W[0],
    neverOpened: [{ role: "Deep clean", room: "Noble", phase: "mid" }],
    neverSigned: [],
    notDone: [],
  });
}

// ------------------------------------------- worked is not the same as unopened
//
// One night, four lists, one in each pile and one done. The hot line had half
// its boxes ticked and no signature, and the page listed it under "never
// opened, nobody did these" beside a list with no ticks at all. A tick on an
// unsigned list moves it to never signed, with the count that proves it.
{
  const one = ["2026-11-12"];
  const lists = [
    { id: "HL", venue_id: "V", house: "HOH", role: "Hot line", phase: "close" },
    { id: "DP", venue_id: "V", house: "HOH", role: "Dish pit", phase: "close" },
    { id: "PR", venue_id: "V", house: "HOH", role: "Prep", phase: "open" },
    { id: "MG", venue_id: "V", house: "FOH", role: "Manager", phase: "close" },
    { id: "BR", venue_id: "V", house: "FOH", role: "Bar", phase: "close" },
  ];
  const rows = [
    ...["a", "b", "c", "d"].map((k) => ({ id: `hl-${k}`, checklist_id: "HL", title: `Hot line ${k}` })),
    ...["a", "b"].map((k) => ({ id: `dp-${k}`, checklist_id: "DP", title: `Dish pit ${k}` })),
    ...["a", "b"].map((k) => ({ id: `pr-${k}`, checklist_id: "PR", title: `Prep ${k}` })),
    ...["a", "b"].map((k) => ({ id: `mg-${k}`, checklist_id: "MG", title: `Manager ${k}` })),
    { id: "br-a", checklist_id: "BR", title: "Bar a" },
  ];
  const opened = [
    // Worked, two of four, nobody signed.
    { id: "n-hl", checklist_id: "HL", night: one[0], certified_at: null, certified_by: null },
    // The screen was opened and nothing ticked: a row, and still never opened.
    { id: "n-dp", checklist_id: "DP", night: one[0], certified_at: null, certified_by: null },
    // Prep has no row at all.
    // Signed with one left.
    { id: "n-mg", checklist_id: "MG", night: one[0], certified_at: "t", certified_by: "Ana" },
    // Done and signed.
    { id: "n-br", checklist_id: "BR", night: one[0], certified_at: "t", certified_by: "Bo" },
  ];
  const split = computeRollup({
    checklists: lists, items: rows, nights: opened,
    ticks: [
      { night_id: "n-hl", item_id: "hl-a" },
      { night_id: "n-hl", item_id: "hl-b" },
      { night_id: "n-mg", item_id: "mg-a" },
      { night_id: "n-br", item_id: "br-a" },
    ],
  }, one);
  is("split: three piles, and a worked list is not never opened", split.latest, {
    night: one[0],
    neverOpened: [
      { role: "Dish pit", room: null, phase: "close" },
      { role: "Prep", room: null, phase: "open" },
    ],
    neverSigned: [{ role: "Hot line", room: null, phase: "close", ticked: 2, owed: 4 }],
    notDone: [{ role: "Manager", room: null, phase: "close", by: "Ana" }],
  });
  // The split changes which pile a list is named in and nothing else: it is
  // still one of five done and signed, and still a short night.
  is("split: the score does not move", [split.done, split.of, split.strip], [1, 5, "m"]);

  // Every box ticked and no signature is still never signed, not done.
  const allTicked = computeRollup({
    checklists: [lists[0]], items: rows, nights: [opened[0]],
    ticks: ["a", "b", "c", "d"].map((k) => ({ night_id: "n-hl", item_id: `hl-${k}` })),
  }, one);
  is("split: all ticked, nobody signed, is never signed", allTicked.latest, {
    night: one[0],
    neverOpened: [],
    neverSigned: [{ role: "Hot line", room: null, phase: "close", ticked: 4, owed: 4 }],
    notDone: [],
  });

  // A deep clean rota: Thursday's two boxes are what the night owed. One of
  // them ticked, plus Monday's done on the wrong day, is two ticked of three,
  // the same count the night page shows: a tick counts whether or not it was
  // owed, and the boxes owed on other nights are not on the bill.
  const rota = [
    { id: "t1", checklist_id: "HL", title: "Thursday one", section: "THURSDAY" },
    { id: "t2", checklist_id: "HL", title: "Thursday two", section: "THURSDAY" },
    { id: "m1", checklist_id: "HL", title: "Monday one", section: "MONDAY" },
    { id: "f1", checklist_id: "HL", title: "Friday one", section: "FRIDAY" },
  ];
  const wrongDay = computeRollup({
    checklists: [lists[0]], items: rota, nights: [opened[0]],
    ticks: [{ night_id: "n-hl", item_id: "t1" }, { night_id: "n-hl", item_id: "m1" }],
  }, one, isDue);
  is("split: ticks count whether or not owed, owed nights only on the bill",
    wrongDay.latest.neverSigned,
    [{ role: "Hot line", room: null, phase: "close", ticked: 2, owed: 3 }]);
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

// Streak and the recent window: trailing misses count back from the newest
// night the item was owed, and stop at the first night it was done.
{
  const four = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30"];
  const lists = [{ id: "H", venue_id: "V", house: "FOH", role: "Host", phase: "close" }];
  const rows = [{ id: "rest", checklist_id: "H", title: "Restrooms" }];
  const opened = four.map((n, i) => ({ id: `h${i}`, checklist_id: "H", night: n, certified_at: "t", certified_by: "x" }));
  // Done only the first night, missed the last three running.
  const streaky = computeRollup({ checklists: lists, items: rows, nights: opened, ticks: [{ night_id: "h0", item_id: "rest" }] }, four, isDue);
  is("streak: missed the last three nights running",
    streaky.missed.map((m) => [m.item, m.open, m.of, m.streak, m.recentOpen, m.recentOf]),
    [["Restrooms", 3, 4, 3, 3, 4]]);
  // Done again on the newest night breaks the streak to zero, though it is
  // still three of four missed over the window.
  const broken = computeRollup({ checklists: lists, items: rows, nights: opened, ticks: [{ night_id: "h3", item_id: "rest" }] }, four, isDue);
  is("streak: a miss done again on the newest owed night is not running",
    broken.missed.map((m) => [m.item, m.open, m.of, m.streak]),
    [["Restrooms", 3, 4, 0]]);
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
  is("rota: the week is seven owed not forty nine", nothing.byRole, [{ role: "Bar deep clean", done: 0, of: 7 }]);

  // The week done exactly as written: one item a night, on its own day.
  const asWritten = computeRollup({ checklists: deep, items: rota, nights: opened, ticks: allTicks }, week, isDue);
  is("rota: doing it right reports nothing missed", asWritten.missed, []);
  is("rota: and reads as complete", asWritten.byRole, [{ role: "Bar deep clean", done: 7, of: 7 }]);
  is("rota: and the strip is a clean week", asWritten.strip, "ccccccc");
  is("rota: the venue is not marked down for it",
    computeGroup({ checklists: deep, items: rota, nights: opened, ticks: allTicks }, week, new Map([["V", "HOOD"]]), isDue),
    [{ code: "HOOD", done: 7, of: 7 }]);

  // Only Monday's done.
  const mondayOnly = computeRollup({ checklists: deep, items: rota, nights: opened, ticks: [{ night_id: "w0", item_id: "d0" }] }, week, isDue);
  is("rota: Monday done leaves six owed", mondayOnly.missed.length, 6);
  is("rota: and Monday is not among them", mondayOnly.missed.some((m) => m.item === "MONDAY"), false);
  is("rota: one of seven", mondayOnly.byRole, [{ role: "Bar deep clean", done: 1, of: 7 }]);
}

// ------------------------------------------------- the frozen snapshot
//
// A certified night is scored against the list it was signed against, not
// today's. An item added since is not counted on the nights before it existed,
// and one retired since still shows for the nights it was on the board.
{
  const W2 = ["2026-08-10", "2026-08-11", "2026-08-12"];
  const lists = [{ id: "L", venue_id: "V", house: "FOH", role: "MOD", phase: "close" }];
  // Today's board: i1 and a since-added iNew. iRetired is gone from it and
  // lives only in the old snapshots.
  const now = [
    { id: "i1", checklist_id: "L", title: "Back door" },
    { id: "iNew", checklist_id: "L", title: "Ice well" },
  ];
  const nights = [
    { id: "n1", checklist_id: "L", night: W2[0], certified_at: "t", certified_by: "Ana",
      signed: [{ item_id: "i1", title: "Back door", ticked: true }, { item_id: "iRetired", title: "Old thing", ticked: false }] },
    { id: "n2", checklist_id: "L", night: W2[1], certified_at: "t", certified_by: "Ana",
      signed: [{ item_id: "i1", title: "Back door", ticked: true }, { item_id: "iRetired", title: "Old thing", ticked: false }] },
    { id: "n3", checklist_id: "L", night: W2[2], certified_at: "t", certified_by: "Ana",
      signed: [{ item_id: "i1", title: "Back door", ticked: true }, { item_id: "iNew", title: "Ice well", ticked: false }] },
  ];
  const snap = computeRollup({ checklists: lists, items: now, nights, ticks: [] }, W2, isDue);
  // iRetired kept for the two nights it was on the board; iNew only for the one
  // it existed, not the three the window has.
  is("snapshot: retired item kept, new item not back-counted",
    snap.missed.map((m) => [m.item, m.open, m.of]),
    [["Old thing", 2, 2], ["Ice well", 1, 1]]);
  is("snapshot: signed-with-gaps nights are not done", snap.strip, "mmm");
  is("snapshot: none done and signed", [snap.done, snap.of], [0, 3]);
}

// A night signed clean is done even though the list has grown since. Today's
// board carries an extra item that did not exist that night; the snapshot does
// not, so it is not a false open.
{
  const one = ["2026-08-13"];
  const lists = [{ id: "L", venue_id: "V", house: "FOH", role: "MOD", phase: "close" }];
  const now = [
    { id: "i1", checklist_id: "L", title: "Back door" },
    { id: "i2", checklist_id: "L", title: "Stanchions" },
    { id: "iNew", checklist_id: "L", title: "Ice well" },
  ];
  const nights = [
    { id: "n1", checklist_id: "L", night: one[0], certified_at: "t", certified_by: "Ana",
      signed: [{ item_id: "i1", title: "Back door", ticked: true }, { item_id: "i2", title: "Stanchions", ticked: true }] },
  ];
  const clean = computeRollup({ checklists: lists, items: now, nights, ticks: [] }, one, isDue);
  is("snapshot: a clean signed night is done despite a since-added item", clean.strip, "c");
  is("snapshot: no false open from the new item", clean.missed, []);
  is("snapshot: byRole reads the snapshot", clean.byRole, [{ role: "MOD", done: 1, of: 1 }]);
  is("snapshot: group done from the snapshot",
    computeGroup({ checklists: lists, items: now, nights, ticks: [] }, one, new Map([["V", "HOOD"]]), isDue),
    [{ code: "HOOD", done: 1, of: 1 }]);
}

// ------------------------------------------- a weekly item scores once a week

// A full Monday-to-Sunday week the venue was open every night, one close list
// with a plain item and a WEEKLY one. Scored from the following week, so the
// week has closed. The whole point: the weekly item is owed once, not seven
// times, so an undone one is a single miss and a done one is a single clean.
{
  const WK = [
    "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10",
    "2026-09-11", "2026-09-12", "2026-09-13",
  ];
  const lists = [{ id: "L", venue_id: "V", house: "FOH", role: "BARBACK", phase: "close" }];
  const items = [
    { id: "d", checklist_id: "L", title: "Wipe the rail", section: null },
    { id: "w", checklist_id: "L", title: "Deep clean the well", section: "WEEKLY" },
  ];
  // The venue ran and signed every night; the plain item ticked each night.
  const nights = WK.map((night, i) => ({
    id: `n${i}`, checklist_id: "L", night, certified_at: "t", certified_by: "Marla",
  }));
  const tickedDaily = WK.map((_, i) => ({ night_id: `n${i}`, item_id: "d" }));

  const ctx = {
    cadenceByItem: new Map([["w", "weekly"]]),
    runningNightsByItem: new Map([["w", WK]]),
    today: "2026-09-20",
  };
  const cadenceDue = (tickNights) =>
    makeCadenceDue({ ...ctx, tickNightsByItem: new Map([["w", tickNights]]) });

  // Never done all week: exactly one miss, not seven, landing on the last night.
  const missed = computeRollup(
    { checklists: lists, items, nights, ticks: tickedDaily }, WK, cadenceDue([]),
  );
  is("weekly undone is one open of one, not seven of seven",
    missed.missed.map((m) => [m.item, m.open, m.of]),
    [["Deep clean the well", 1, 1]]);
  is("the undone weekly fails only the last night", missed.strip, "ccccccm");

  // Done once, on Wednesday: no miss, every night clean.
  const done = computeRollup(
    { checklists: lists, items, nights, ticks: [...tickedDaily, { night_id: "n2", item_id: "w" }] },
    WK, cadenceDue(["2026-09-09"]),
  );
  is("a weekly done once leaves nothing open", done.missed, []);
  is("and every night reads clean", done.strip, "ccccccc");
}

// ----------------------------------------------------------- on the bill
//
// A list counts on a night only when something on it was owed that night, or
// somebody did something on it. The night page and the morning email have
// always worked that way. This report counted every list every night, so Born
// & Raised read 622 of 817 here on the nights the email said 38 of 42, and a
// weekly manager list sat under "never opened" for being weekly.
{
  // Mon 11/9 to Sun 11/15, then Mon 11/16.
  const week = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
  const lists = [
    { id: "SV", venue_id: "V", house: "FOH", role: "Server", phase: "close" },
    // Runs Thursday to Sunday only.
    { id: "BA", venue_id: "V", house: "FOH", role: "Bathroom attendant", phase: "close" },
    // Nothing but weekly work.
    { id: "MM", venue_id: "V", house: "FOH", role: "Manager", phase: "mid" },
    // Switched on, nothing written on it yet.
    { id: "NW", venue_id: "V", house: "FOH", role: "New list", phase: "open" },
  ];
  const THU_SUN = ["THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  const rows = [
    { id: "sv", checklist_id: "SV", title: "Section clean" },
    { id: "ba", checklist_id: "BA", title: "Restock", days: THU_SUN },
    { id: "mm", checklist_id: "MM", title: "Clear the voicemail", section: "WEEKLY" },
  ];
  // The server list is done and signed all seven nights. The attendant signs
  // Thursday and Friday and skips the weekend. The manager does the weekly
  // list on Wednesday.
  const signedNight = (id, list, night, ticked) => ({
    id, checklist_id: list, night, certified_at: "t", certified_by: "Ana",
    signed: rows.filter((r) => r.checklist_id === list).map((r) => ({
      item_id: r.id, title: r.title, section: r.section ?? null, days: r.days ?? null, ticked,
    })),
  });
  const held = [
    ...week.map((n, i) => signedNight(`sv${i}`, "SV", n, true)),
    signedNight("ba3", "BA", week[3], true),
    signedNight("ba4", "BA", week[4], true),
    signedNight("mm2", "MM", week[2], true),
  ];
  const data = { checklists: lists, items: rows, nights: held, ticks: [] };
  const cadenceDue = (today) => makeCadenceDue({
    cadenceByItem: new Map([["mm", "weekly"]]),
    tickNightsByItem: tickNightsOf(data, (id) => id === "mm"),
    runningNightsByItem: new Map([["mm", week]]),
    today,
  });
  const bill = computeRollup(data, week, cadenceDue("2026-11-16"), isCadence);

  // Server 7. Attendant 4 (Thu to Sun). Manager mid 1 (the night it was done).
  // The unwritten list never.
  is("bill: lists owed, night by night", bill.series.map((n) => n.of), [1, 1, 2, 2, 2, 2, 2]);
  is("bill: done and signed, night by night", bill.series.map((n) => n.done), [1, 1, 2, 2, 2, 1, 1]);
  is("bill: ten of twelve, not ten of twenty eight", [bill.done, bill.of], [10, 12]);
  is("bill: a clean night is clean with the weekly list standing by", bill.strip, "cccccmm");
  is("bill: Sunday names the attendant and nothing else", bill.latest, {
    night: week[6],
    neverOpened: [{ role: "Bathroom attendant", room: null, phase: "close" }],
    neverSigned: [],
    notDone: [],
  });
  is("bill: per position, the same ruler", bill.byRole, [
    { role: "Server", done: 7, of: 7 },
    { role: "Manager", done: 1, of: 1 },
    { role: "Bathroom attendant", done: 2, of: 4 },
  ]);
  is("bill: the group score agrees", computeGroup(data, week, new Map([["V", "VEN"]]), cadenceDue("2026-11-16"), isCadence),
    [{ code: "VEN", done: 10, of: 12 }]);

  // The same week with the weekly list never done. While the week is still
  // open it is on no night's bill. Once the week has closed it lands on the
  // last night the venue was open, as one miss, not seven.
  const undone = { ...data, nights: held.filter((n) => n.checklist_id !== "MM") };
  const due = (today) => makeCadenceDue({
    cadenceByItem: new Map([["mm", "weekly"]]),
    tickNightsByItem: new Map(),
    runningNightsByItem: new Map([["mm", week]]),
    today,
  });
  const midWeek = computeRollup(undone, week, due("2026-11-13"), isCadence);
  is("bill: a weekly list not yet done is not a miss while the week is open",
    midWeek.series.map((n) => n.of), [1, 1, 1, 2, 2, 2, 2]);
  const closed = computeRollup(undone, week, due("2026-11-16"), isCadence);
  is("bill: undone when the week closes, it is owed once, on the last night",
    closed.series.map((n) => n.of), [1, 1, 1, 2, 2, 2, 3]);
  is("bill: and named there", closed.latest.neverOpened.map((l) => l.role),
    ["Bathroom attendant", "Manager"]);

  // A tick on a night a list owed nothing puts it on that night's bill: work
  // done on the wrong day is seen, not dropped.
  const early = computeRollup({
    ...data,
    nights: [...held, { id: "baTue", checklist_id: "BA", night: week[1], certified_at: null, certified_by: null }],
    ticks: [{ night_id: "baTue", item_id: "ba" }],
  }, week, cadenceDue("2026-11-16"), isCadence);
  is("bill: worked on an off night, it is on that night's bill", early.series[1].of, 2);

  // Jaynes, Thursday 11/12: a deep clean of six weekly jobs, one of them ticked
  // and nobody signed. The night page said "weekly, not due tonight" and this
  // report said "never signed, 1 of 1". The week was not over, so the night
  // page was right: a weekly list in progress is on nobody's bill.
  const deep = [{ id: "DC", venue_id: "V", house: "FOH", role: "Deep clean", phase: "mid", room: "Cafe" }];
  const jobs = ["a", "b", "c", "d", "e", "f"].map((k) => ({ id: `dc-${k}`, checklist_id: "DC", title: `Job ${k}`, section: "WEEKLY" }));
  const worked = {
    checklists: [lists[0], ...deep], items: [rows[0], ...jobs],
    nights: [
      ...week.map((n, i) => signedNight(`sv${i}`, "SV", n, true)),
      { id: "dcThu", checklist_id: "DC", night: week[3], certified_at: null, certified_by: null },
    ],
    ticks: [{ night_id: "dcThu", item_id: "dc-a" }],
  };
  const weeklyDue = (today) => makeCadenceDue({
    cadenceByItem: new Map(jobs.map((j) => [j.id, "weekly"])),
    tickNightsByItem: tickNightsOf(worked, (id) => id.startsWith("dc-")),
    runningNightsByItem: new Map(jobs.map((j) => [j.id, week])),
    today,
  });
  const thursday = computeRollup(worked, week.slice(0, 4), weeklyDue("2026-11-13"), isCadence);
  is("bill: a weekly list in progress is not on Thursday's bill", thursday.series[3], { night: week[3], done: 1, of: 1 });
  is("bill: and is in none of the piles", thursday.latest, { night: week[3], neverOpened: [], neverSigned: [], notDone: [] });
  // The week closes with five of the six never done: owed once, on Sunday.
  const sunday = computeRollup(worked, week, weeklyDue("2026-11-16"), isCadence);
  is("bill: the jobs nobody did come due when the week closes", sunday.series.map((n) => n.of), [1, 1, 1, 1, 1, 1, 2]);
  is("bill: named as never opened that night", sunday.latest.neverOpened, [{ role: "Deep clean", room: "Cafe", phase: "mid" }]);
  // Without the cadence rule handed in, the old reading comes back: this is
  // what the parameter is for.
  is("bill: unaware of cadence, Thursday reads never signed",
    computeRollup(worked, week.slice(0, 4), weeklyDue("2026-11-13")).latest.neverSigned.length, 1);
}

// ------------------------------------------------ what the loader has to read
//
// A single read stops at a thousand rows. Born & Raised had 13,693 ticks in
// the window and the report scored it on whichever thousand came back. These
// are the three small rules the loader now leans on to read everything it
// needs and nothing it does not.
{
  is("runs: cut in order", chunksOf([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  is("runs: an exact fit has no empty tail", chunksOf([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
  is("runs: nothing in, nothing out", chunksOf([], 100), []);
  is("runs: a short list is one run", chunksOf(["a"], 100), [["a"]]);
  is("runs: a silly size still moves forward", chunksOf([1, 2], 0), [[1], [2]]);
  // Nothing lost and nothing repeated, at the sizes the loader uses.
  const ids = Array.from({ length: 690 }, (_, i) => `n${i}`);
  const runs = chunksOf(ids, 100);
  is("runs: 690 nights is seven requests", runs.length, 7);
  is("runs: every id once", runs.flat().join(), ids.join());

  const frozen = (ticked) => [
    { item_id: "w", title: "Weekly bar clean", section: "WEEKLY", ticked },
    { item_id: "d", title: "Doors", section: null, ticked: true },
  ];
  const nights = [
    // Signed, weekly job done: read from the frozen list.
    { id: "n1", checklist_id: "L", night: "2026-11-09", certified_at: "t", certified_by: "Ana", signed: frozen(true) },
    // Signed, weekly job skipped.
    { id: "n2", checklist_id: "L", night: "2026-11-10", certified_at: "t", certified_by: "Ana", signed: frozen(false) },
    // Still open: no frozen list, so its ticks come from the tick table.
    { id: "n3", checklist_id: "L", night: "2026-11-11", certified_at: null, certified_by: null, signed: null },
    // A row with nothing on it yet.
    { id: "n4", checklist_id: "L", night: "2026-11-12", certified_at: null, certified_by: null },
  ];
  is("ticks are read only for nights with no frozen list", nightsNeedingTicks(nights), ["n3", "n4"]);
  is("no nights, no ticks to read", nightsNeedingTicks([]), []);

  const ticks = [
    { night_id: "n3", item_id: "w" },
    { night_id: "n3", item_id: "w" }, // the same box twice is one night
    { night_id: "n3", item_id: "d" },
    // A stray live tick on a signed night: the frozen list is the record.
    { night_id: "n2", item_id: "w" },
    // A tick for a night that is not in the load at all.
    { night_id: "gone", item_id: "w" },
  ];
  const weekly = tickNightsOf({ nights, ticks }, (id) => id === "w");
  is("tick nights: frozen list and live ticks together, oldest first",
    weekly.get("w"), ["2026-11-09", "2026-11-11"]);
  is("tick nights: only the items asked for", [...weekly.keys()], ["w"]);
  is("tick nights: an item never ticked is not in the map",
    tickNightsOf({ nights, ticks: [] }, (id) => id === "x").has("x"), false);

  // The point of it: the weekly rule gets the same answer whether the signed
  // night's ticks were loaded or not, because it no longer needs them.
  const cadence = (tickNightsByItem) => makeCadenceDue({
    cadenceByItem: new Map([["w", "weekly"]]),
    tickNightsByItem,
    runningNightsByItem: new Map([["w", ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]]]),
    today: "2026-11-17",
  });
  const due = cadence(tickNightsOf({ nights, ticks: [] }, (id) => id === "w"));
  is("weekly done on a signed night is scored there, with no live ticks loaded",
    ["2026-11-09", "2026-11-10", "2026-11-15"].map((n) => due({ id: "w", section: "WEEKLY" }, n)),
    [true, false, false]);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
