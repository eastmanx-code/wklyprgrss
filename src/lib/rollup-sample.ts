/**
 * Illustrative figures for the rollup, so the shape of the report can be shown
 * before there is anything to report on.
 *
 * Every number here is made up. It is in its own file, named for what it is,
 * so that when nights start being recorded this module is deleted rather than
 * quietly left behind feeding a real screen. The page that renders it says so
 * on its face too — a report nobody can tell is fake is worse than no report.
 */

export type MissedRow = {
  house: "FOH" | "HOH";
  role: string;
  phase: "open" | "mid" | "close";
  item: string;
  /** Nights the item was still open when the list was signed. */
  open: number;
  of: number;
};

export const SAMPLE_NIGHTS = 30;

/** One character per night, most recent last. */
export const SAMPLE_STRIP = "cccgccccmcccgcccccgcccmccccgcc";

export const SAMPLE_MISSED: MissedRow[] = [
  {
    house: "FOH",
    role: "MOD",
    phase: "close",
    item: "Stanchions polished",
    open: 9,
    of: 30,
  },
  {
    house: "HOH",
    role: "Line",
    phase: "close",
    item: "Hood filters degreased",
    open: 8,
    of: 30,
  },
  {
    house: "FOH",
    role: "MOD",
    phase: "close",
    item: "Maintenance & final walk",
    open: 7,
    of: 30,
  },
  {
    house: "FOH",
    role: "Bartender",
    phase: "close",
    item: "Draft lines flushed",
    open: 6,
    of: 30,
  },
  {
    house: "FOH",
    role: "MOD",
    phase: "close",
    item: "Full close restroom walkthrough",
    open: 6,
    of: 30,
  },
  {
    house: "HOH",
    role: "Dish",
    phase: "close",
    item: "Floor drains flushed",
    open: 5,
    of: 30,
  },
  {
    house: "FOH",
    role: "MOD",
    phase: "close",
    item: "Positive moment check-ins",
    open: 5,
    of: 30,
  },
  {
    house: "HOH",
    role: "Prep",
    phase: "open",
    item: "Walk-in temp logged",
    open: 4,
    of: 30,
  },
];

export const SAMPLE_BY_ROLE: { role: string; done: number; of: number }[] = [
  { role: "MOD", done: 268, of: 300 },
  { role: "Bartender", done: 241, of: 300 },
  { role: "Line", done: 232, of: 300 },
  { role: "Server", done: 219, of: 240 },
  { role: "Prep", done: 205, of: 240 },
  { role: "Dish", done: 176, of: 240 },
];

export const SAMPLE_CERTIFIERS: { who: string; nights: number }[] = [
  { who: "Marisol R.", nights: 11 },
  { who: "Dev P.", nights: 8 },
  { who: "Anh T.", nights: 5 },
];

/** What the group view becomes — the same question one level up. */
export const SAMPLE_VENUES: { code: string; done: number; of: number }[] = [
  { code: "HAWK", done: 268, of: 300 },
  { code: "ISFO", done: 254, of: 300 },
  { code: "BORN", done: 249, of: 300 },
  { code: "LEIL", done: 231, of: 300 },
  { code: "CRFT", done: 198, of: 300 },
  { code: "MORN", done: 141, of: 300 },
];
